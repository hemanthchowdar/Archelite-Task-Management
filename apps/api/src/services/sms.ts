import { config } from '../config';

/**
 * Send an OTP via MSG91 API or fall back to mock logging if no API credentials exist.
 * MSG91 expects mobile numbers in full international format without the leading '+'.
 */
export async function sendOtpSms(phone: string, otp: string): Promise<boolean> {
  const cleanPhone = phone.replace('+', '');

  if (!config.MSG91_API_KEY || !config.MSG91_TEMPLATE_ID) {
    console.log('\n=========================================');
    console.log(`💬  [MOCK SMS] To: ${phone}`);
    console.log(`🔑  Your OTP Code is: ${otp}`);
    console.log('=========================================\n');
    return true;
  }

  try {
    const url = `https://control.msg91.com/api/v5/otp?template_id=${config.MSG91_TEMPLATE_ID}&mobile=${cleanPhone}&authkey=${config.MSG91_API_KEY}`;
    
    // Note: We use global fetch (available in Node 18+)
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        otp: otp, // Tells MSG91 to use this specific code instead of generating one
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ MSG91 SMS delivery failed: ${response.status} ${response.statusText} - ${errorText}`);
      return false;
    }

    const data = await response.json();
    console.log(`✅ MSG91 SMS sent successfully to ${phone}:`, data);
    return true;
  } catch (error) {
    console.error('❌ Error sending MSG91 SMS:', error);
    return false;
  }
}
