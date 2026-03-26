import nodemailer from 'nodemailer';

export async function POST(req) {
  try {
    const { email, name, monthName, year, pdfBase64 } = await req.json();

    // 1. Configure the Zoho Mail sender
    const transporter = nodemailer.createTransport({
      host: 'smtp.zoho.in', // If this fails, try smtp.zoho.com based on your account region
      port: 465,
      secure: true, 
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // 2. Format the email and attach the PDF
    const mailOptions = {
      from: `"CONQRETE HR" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `CONQRETE Payslip - ${monthName} ${year}`,
      text: `Hello ${name},\n\nPlease find attached your official payslip for ${monthName} ${year}.\n\nBest regards,\nCONQRETE Management`,
      attachments: [
        {
          filename: `CONQRETE_Payslip_${name.replace(/\s+/g, '_')}_${monthName}_${year}.pdf`,
          content: pdfBase64.split("base64,")[1], // Strip the data URI prefix so it attaches correctly
          encoding: 'base64'
        }
      ]
    };

    // 3. Send the email
    await transporter.sendMail(mailOptions);
    
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error("Email API Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}