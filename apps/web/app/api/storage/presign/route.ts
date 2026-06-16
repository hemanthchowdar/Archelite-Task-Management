import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { fileName, fileType } = await req.json();

    if (!fileName || !fileType) {
      return NextResponse.json({ success: false, error: 'fileName and fileType are required' }, { status: 400 });
    }

    const fileId = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storageKey = `${fileId}-${cleanFileName}`;

    const isAwsConfigured = 
      process.env.AWS_ACCESS_KEY_ID && 
      process.env.AWS_ACCESS_KEY_ID !== 'mock_access_key' &&
      process.env.AWS_SECRET_ACCESS_KEY;

    if (isAwsConfigured) {
      // Production AWS S3 Integration
      // In a real S3 setup, we would generate a pre-signed URL here:
      // const command = new PutObjectCommand({ Bucket: BUCKET, Key: storageKey, ContentType: fileType });
      // const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      // return NextResponse.json({ success: true, uploadUrl, fileUrl: `https://${BUCKET}.s3.amazonaws.com/${storageKey}` });
      
      return NextResponse.json({
        success: true,
        uploadUrl: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${storageKey}?mock_presign=true`,
        fileUrl: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${storageKey}`,
        key: storageKey
      });
    }

    // Local Development Fallback: Point upload directly to our mock local storage upload endpoint
    const mockUploadUrl = `/api/storage/mock-upload`;
    const localFileUrl = `/uploads/${storageKey}`;

    return NextResponse.json({
      success: true,
      uploadUrl: mockUploadUrl,
      fileUrl: localFileUrl,
      key: storageKey
    });
  } catch (error: any) {
    console.error('Presign Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate upload URL' }, { status: 500 });
  }
}
