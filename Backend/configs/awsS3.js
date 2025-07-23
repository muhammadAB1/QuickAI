import { PutObjectCommand, S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3Client = new S3Client({
    region: 'ap-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY
    }
})

export async function putObject(fileBuffer, filename, ContentType) {
    const command = new PutObjectCommand({
        Bucket: 'quickai-images',
        Key: `quickAI/${filename}`,
        ContentType: ContentType,
        Body: fileBuffer,
    });
    // const signedUrl = await getSignedUrl(s3Client, command, {expiresIn: 60});
    // return url;

    await s3Client.send(command);

    return filename

    // return signedUrl
    // return url;
}

export async function getObject(key) {
    const command = new GetObjectCommand({
        Bucket: 'quickai-images',
        Key: key,
    });
    const signedUrl = await getSignedUrl(s3Client, command);
    return signedUrl;
}


