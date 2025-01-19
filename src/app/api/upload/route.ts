import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from "next/server";

const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME;
const storage = new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    credentials: {
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
});

const bucket = storage.bucket(bucketName!);

const getFileExtension = (filename: string): string => {
    const lastDotIndex = filename.lastIndexOf(".");
    if (lastDotIndex === -1) return "";
    return filename.substring(lastDotIndex);
};

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const files = formData.getAll("file") as File[];
        
        if (files.length === 0) {
            return NextResponse.json({ message: "No file uploaded" }, { status: 400 });
        }
        
        if(files.length > 1) {
            return NextResponse.json({ message: "Only one file is allowed" }, { status: 400 });
        }

        if (files[0].type == "image/jpeg" || files[0].type == "image/png" || files[0].type == "image/webp" || files[0].type == "image/jpg") {
            const FileId = randomUUID();
            let url = "";
            
            await Promise.all(
                files.map(async (file) => {
                    const Body = Buffer.from(await file.arrayBuffer());
                    const fileName = `${FileId}${getFileExtension(file.name)}`;
                    const blob = bucket.file(fileName);
                    
                    const blobStream = blob.createWriteStream({
                        metadata: {
                            contentType: file.type
                        }
                    });

                    await new Promise((resolve, reject) => {
                        blobStream.on('error', reject);
                        blobStream.on('finish', resolve);
                        blobStream.end(Body);
                    });

                    url = `https://storage.googleapis.com/${bucketName}/${fileName}`;
                })
            );
            
            return NextResponse.json({ message: "File uploaded successfully", URL: url }, { status: 200 });
        } else if (files[0].type == "application/pdf") {
            const FileId = randomUUID();
            let url = "";
            
            await Promise.all(
                files.map(async (file) => {
                    const Body = Buffer.from(await file.arrayBuffer());
                    const fileName = `Contracts/${FileId}${getFileExtension(file.name)}`;
                    const blob = bucket.file(fileName);
                    
                    const blobStream = blob.createWriteStream({
                        metadata: {
                            contentType: file.type
                        }
                    });

                    await new Promise((resolve, reject) => {
                        blobStream.on('error', reject);
                        blobStream.on('finish', resolve);
                        blobStream.end(Body);
                    });

                    url = `https://storage.googleapis.com/${bucketName}/${fileName}`;
                })
            );
            
            return NextResponse.json({ message: "File uploaded successfully", URL: url }, { status: 200 });
        }
        
        return NextResponse.json({ message: "File need to be image or pdf" }, { status: 400 });

    } catch (error) {
        console.log(error);
        return NextResponse.json(error);
    }
}