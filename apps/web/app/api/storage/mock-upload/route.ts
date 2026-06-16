import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let fileBuffer: Buffer;
    let fileName = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      if (!file) {
        return NextResponse.json({ success: false, error: 'No file found in form data' }, { status: 400 });
      }
      fileBuffer = Buffer.from(await file.arrayBuffer());
      fileName = file.name;
    } else {
      // Raw binary upload
      fileBuffer = Buffer.from(await req.arrayBuffer());
      // Try to extract name from headers or query
      const url = new URL(req.url);
      fileName = url.searchParams.get('key') || req.headers.get('x-file-name') || 'uploaded_file';
    }

    // Set up local upload destination directory
    // Next.js static files live in /public/
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    
    // Ensure upload directory exists
    await fs.mkdir(uploadDir, { recursive: true });

    // Write file locally
    const filePath = path.join(uploadDir, fileName);
    await fs.writeFile(filePath, fileBuffer);

    console.log(`[MOCK STORAGE] Successfully stored file locally: ${filePath} (${fileBuffer.length} bytes)`);

    return NextResponse.json({
      success: true,
      fileUrl: `/uploads/${fileName}`,
      fileName
    });
  } catch (error: any) {
    console.error('Mock Upload Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to write file locally' }, { status: 500 });
  }
}
