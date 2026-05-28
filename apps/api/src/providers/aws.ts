import {
  EC2Client,
  DescribeInstancesCommand,
  RunInstancesCommand,
  TerminateInstancesCommand,
  StartInstancesCommand,
  StopInstancesCommand,
  DescribeRegionsCommand,
  ImportKeyPairCommand,
  DescribeKeyPairsCommand,
} from "@aws-sdk/client-ec2";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import type {
  AwsCredentials,
  CloudProviderAdapter,
  NormalizedInstance,
  ProvisionRequest,
  ProvisionResult,
} from "./types.js";

export class AwsAdapter implements CloudProviderAdapter {
  readonly provider = "aws" as const;
  constructor(private creds: AwsCredentials) {}

  private ec2(region: string = this.creds.defaultRegion) {
    return new EC2Client({
      region,
      credentials: {
        accessKeyId: this.creds.accessKeyId,
        secretAccessKey: this.creds.secretAccessKey,
      },
    });
  }

  async verify() {
    try {
      const sts = new STSClient({
        region: this.creds.defaultRegion,
        credentials: {
          accessKeyId: this.creds.accessKeyId,
          secretAccessKey: this.creds.secretAccessKey,
        },
      });
      const out = await sts.send(new GetCallerIdentityCommand({}));
      return { ok: true, identity: out.Arn ?? out.UserId ?? "AWS account" };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? String(e) };
    }
  }

  async listInstances(): Promise<NormalizedInstance[]> {
    const ec2 = this.ec2();
    const out = await ec2.send(new DescribeInstancesCommand({}));
    const instances: NormalizedInstance[] = [];
    for (const r of out.Reservations ?? []) {
      for (const i of r.Instances ?? []) {
        if (!i.InstanceId) continue;
        const nameTag = i.Tags?.find((t) => t.Key === "Name")?.Value;
        const state = i.State?.Name;
        instances.push({
          providerInstanceId: i.InstanceId,
          name: nameTag ?? i.InstanceId,
          region: this.creds.defaultRegion,
          availabilityZone: i.Placement?.AvailabilityZone,
          publicIp: i.PublicIpAddress,
          privateIp: i.PrivateIpAddress,
          os: i.PlatformDetails ?? i.Platform,
          status:
            state === "running"
              ? "running"
              : state === "stopped"
              ? "stopped"
              : state === "pending"
              ? "provisioning"
              : state === "terminated"
              ? "terminated"
              : "error",
          specs: { instanceType: i.InstanceType ?? undefined },
          tags: i.Tags?.map((t) => `${t.Key}=${t.Value}`) ?? [],
        });
      }
    }
    return instances;
  }

  async listRegions() {
    const ec2 = this.ec2();
    const out = await ec2.send(new DescribeRegionsCommand({}));
    return (out.Regions ?? [])
      .filter((r) => r.RegionName)
      .map((r) => ({ slug: r.RegionName!, name: r.RegionName! }));
  }

  async listSizes() {
    // AWS no expone listado simple por API. Hardcodeamos los más comunes.
    return [
      { slug: "t4g.nano", name: "t4g.nano (Graviton, 2vCPU/0.5GB)", cpu: 2, ramMb: 512 },
      { slug: "t4g.micro", name: "t4g.micro (Graviton, 2vCPU/1GB)", cpu: 2, ramMb: 1024 },
      { slug: "t4g.small", name: "t4g.small (Graviton, 2vCPU/2GB)", cpu: 2, ramMb: 2048 },
      { slug: "t3.micro", name: "t3.micro (x86, 2vCPU/1GB)", cpu: 2, ramMb: 1024 },
      { slug: "t3.small", name: "t3.small (x86, 2vCPU/2GB)", cpu: 2, ramMb: 2048 },
      { slug: "t3.medium", name: "t3.medium (x86, 2vCPU/4GB)", cpu: 2, ramMb: 4096 },
    ];
  }

  async createInstance(req: ProvisionRequest): Promise<ProvisionResult> {
    const ec2 = this.ec2(req.region);

    // Importar la llave si no existe (key name = hash de la pub para idempotencia)
    const keyName = `inframonitor-${hash(req.sshPublicKey).slice(0, 12)}`;
    const desc = await ec2.send(new DescribeKeyPairsCommand({ Filters: [{ Name: "key-name", Values: [keyName] }] }));
    if (!desc.KeyPairs?.length) {
      await ec2.send(
        new ImportKeyPairCommand({
          KeyName: keyName,
          PublicKeyMaterial: Buffer.from(req.sshPublicKey, "utf-8"),
        })
      );
    }

    const out = await ec2.send(
      new RunInstancesCommand({
        ImageId: req.os, // ami-xxxxx
        InstanceType: req.size as any,
        MinCount: 1,
        MaxCount: 1,
        KeyName: keyName,
        TagSpecifications: [
          {
            ResourceType: "instance",
            Tags: [{ Key: "Name", Value: req.name }, ...(req.tags ?? []).map((t) => ({ Key: t, Value: "1" }))],
          },
        ],
      })
    );
    const inst = out.Instances?.[0];
    if (!inst?.InstanceId) throw new Error("AWS no devolvió InstanceId");
    return {
      providerInstanceId: inst.InstanceId,
      status: "provisioning",
    };
  }

  async terminateInstance(id: string, region?: string) {
    const ec2 = this.ec2(region);
    await ec2.send(new TerminateInstancesCommand({ InstanceIds: [id] }));
  }

  async startInstance(id: string, region?: string) {
    const ec2 = this.ec2(region);
    await ec2.send(new StartInstancesCommand({ InstanceIds: [id] }));
  }

  async stopInstance(id: string, region?: string) {
    const ec2 = this.ec2(region);
    await ec2.send(new StopInstancesCommand({ InstanceIds: [id] }));
  }
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}
