import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@workspace/database';
import { phoneLoginSchema, emailLoginSchema } from '@workspace/validation';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const isEmail = typeof body.email === 'string';

    // 1. Validate input schema based on type
    let validationResult;
    if (isEmail) {
      validationResult = emailLoginSchema.safeParse(body);
    } else {
      validationResult = phoneLoginSchema.safeParse(body);
    }

    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, errors: validationResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { otp } = body;
    const identifier = isEmail ? body.email : body.phone;

    // 2. Fetch employee from database
    const employee = await prisma.employee.findFirst({
      where: isEmail ? { email: identifier } : { phone: identifier },
    });

    if (!employee) {
      return NextResponse.json(
        { success: false, error: 'Employee not found in the directory' },
        { status: 404 }
      );
    }

    if (employee.status === 'inactive') {
      return NextResponse.json(
        { success: false, error: 'Employee profile is currently inactive' },
        { status: 403 }
      );
    }

    // 3. OTP Verification Step
    if (!otp) {
      // Mock OTP Send Logic
      const mockOtp = '123456';
      console.log(`\n==================================================`);
      console.log(`[MOCK OTP SERVICE]`);
      console.log(`Generated OTP: ${mockOtp}`);
      console.log(`Recipient: ${identifier} (${employee.name})`);
      console.log(`==================================================\n`);

      return NextResponse.json({
        success: true,
        message: 'OTP sent successfully (Mock OTP generated: 123456)',
      });
    }

    // Standard Mock Verification
    const expectedOtp = '123456';
    if (otp !== expectedOtp) {
      return NextResponse.json(
        { success: false, error: 'Invalid verification OTP code' },
        { status: 400 }
      );
    }

    // 4. Issue Mock Session Token
    const sessionToken = `mock-token-${employee.id}-${employee.accessRole}-${Date.now()}`;

    return NextResponse.json({
      success: true,
      token: sessionToken,
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        accessRole: employee.accessRole,
        orgLevel: employee.orgLevel,
        preferredLanguage: employee.preferredLanguage,
      },
    });
  } catch (error: any) {
    console.error('Authentication Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server login error' },
      { status: 500 }
    );
  }
}
