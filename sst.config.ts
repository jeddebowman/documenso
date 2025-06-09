/* eslint-disable turbo/no-undeclared-env-vars */
/* eslint-disable @typescript-eslint/consistent-type-assertions */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="./.sst/platform/config.d.ts" />

const region = (process.env.AWS_REGION || 'us-west-2') as aws.Region;
export default $config({
  app(input) {
    return {
      name: 'documenso',
      removal: input?.stage === 'production' ? 'retain' : 'remove',
      protect: ['production'].includes(input?.stage),
      home: 'aws',
      providers: {
        aws: {
          region,
        },
      },
    };
  },
  async run() {
    const isProduction = $app.stage === 'production';

    // TODO: use static VPC get to obtain the existing VPC
    const vpc = new sst.aws.Vpc('DocumensoVpc');
    const cluster = new sst.aws.Cluster('DocumensoCluster', { vpc });

    // Database configuration
    const db = new sst.aws.Postgres('DocumensoDB', {
      vpc,
      dev: {
        database: 'documenso',
        username: 'documenso',
        password: 'password',
        port: 54320,
      },
    });
    const fromAddress = process.env.NEXT_PRIVATE_SMTP_FROM_ADDRESS ?? 'noreply@documenso.com';
    const email = new sst.aws.Email('DocumensoEmail', { sender: fromAddress });

    const api = new sst.aws.ApiGatewayV2('DocumensoApi', { vpc });
    const documentBucket = new sst.aws.Bucket('DocumensoDocumentBucket');

    // Secrets management - using SST secrets for better security
    const nextAuthSecret = new sst.Secret('NextAuthSecret');
    const encryptionKey = new sst.Secret('EncryptionKey');
    const encryptionSecondaryKey = new sst.Secret('EncryptionSecondaryKey');

    // Certificate handling - use SST secrets
    const signingCertificate = new sst.Secret('SigningCertificate');
    const signingPassphrase = new sst.Secret('SigningPassphrase');

    const appPort = 3000;
    // Build environment variables
    const environment: Record<string, string | $util.Output<string>> = {
      // Core application
      PORT: appPort.toString(),

      // Authentication
      NEXTAUTH_SECRET: nextAuthSecret.value,
      NEXT_PRIVATE_ENCRYPTION_KEY: encryptionKey.value,
      NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY: encryptionSecondaryKey.value,

      // URLs
      NEXT_PUBLIC_WEBAPP_URL: api.url,
      NEXT_PRIVATE_INTERNAL_WEBAPP_URL: api.url,

      // Database
      NEXT_PRIVATE_DATABASE_URL: $interpolate`postgres://${db.username}:${db.password}@${db.host}:${db.port}/${db.database}`,
      NEXT_PRIVATE_DIRECT_DATABASE_URL: $interpolate`postgres://${db.username}:${db.password}@${db.host}:${db.port}/${db.database}`,

      // File uploads - S3 configuration
      NEXT_PUBLIC_UPLOAD_TRANSPORT: 's3',
      NEXT_PRIVATE_UPLOAD_ENDPOINT: documentBucket.domain,
      NEXT_PRIVATE_UPLOAD_FORCE_PATH_STYLE: 'true',
      NEXT_PRIVATE_UPLOAD_REGION: region,
      NEXT_PRIVATE_UPLOAD_BUCKET: documentBucket.name,

      // Signing configuration
      NEXT_PRIVATE_SIGNING_TRANSPORT: 'local',
      NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH: '/opt/documenso/cert.p12',
      NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS: signingCertificate.value,
      NEXT_PRIVATE_SIGNING_PASSPHRASE: signingPassphrase.value,

      // SMTP configuration
      NEXT_PRIVATE_SMTP_TRANSPORT: process.env.NEXT_PRIVATE_SMTP_TRANSPORT ?? 'ses',
      NEXT_PRIVATE_SMTP_FROM_NAME: process.env.NEXT_PRIVATE_SMTP_FROM_NAME ?? 'Documenso',
      NEXT_PRIVATE_SMTP_FROM_ADDRESS: fromAddress,
      NEXT_PRIVATE_SES_REGION: region,

      // Feature flags
      NEXT_PUBLIC_DISABLE_SIGNUP: process.env.NEXT_PUBLIC_DISABLE_SIGNUP ?? 'false',
      NEXT_PUBLIC_DOCUMENT_SIZE_UPLOAD_LIMIT:
        process.env.NEXT_PUBLIC_DOCUMENT_SIZE_UPLOAD_LIMIT ?? '50',

      // Telemetry
      NEXT_TELEMETRY_DISABLED: '1',
    };

    // Add PostHog analytics if configured
    if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      environment.NEXT_PUBLIC_POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    }

    // Service configuration
    const serviceConfig: sst.aws.ServiceArgs = {
      cluster,
      image: {
        dockerfile: 'docker/Dockerfile',
        context: '.',
      },
      link: [db, documentBucket, email],
      environment,
      serviceRegistry: {
        port: appPort,
      },
      scaling: {
        min: isProduction ? 2 : 1,
        max: isProduction ? 10 : 3,
      },
      memory: isProduction ? ('2 GB' as const) : ('1 GB' as const),
      cpu: isProduction ? ('1 vCPU' as const) : ('0.5 vCPU' as const),
      // Health check configuration
      health: {
        // TODO: fix health check
        // command: ['CMD-SHELL', 'curl -f http://localhost:3000/api/health || exit 1'],
        command: ['CMD-SHELL', 'exit 0'],
        startPeriod: '60 seconds' as const,
        timeout: '5 seconds' as const,
        interval: '30 seconds' as const,
        retries: 3,
      },
    };

    // Optional: EFS setup for certificate file mounting in production
    // Uncomment and configure if you need file-based certificate storage
    /*
    if (isProduction) {
      const efs = new sst.aws.Efs('DocumensoEfs', { vpc });
      serviceConfig.volumes = [
        {
          efs: efs,
          path: '/opt/documenso/cert.p12',
        },
      ];
    }
    */

    const service = new sst.aws.Service('DocumensoService', serviceConfig);

    // Configure API Gateway routing
    api.routePrivate('$default', service.nodes.cloudmapService.arn);
  },
});
