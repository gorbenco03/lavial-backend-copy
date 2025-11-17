import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import nodemailer from 'nodemailer';
import { ITicket, IBooking } from '../models';

// Generate ticket PDF
export async function generateTicketPDF(ticket: ITicket, booking: IBooking): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      // Generate QR code
      const qrCodeDataUrl = await QRCode.toDataURL(ticket.qrToken, {
        width: 200,
        margin: 1,
        color: {
          dark: '#111827',
          light: '#FFFFFF'
        }
      });
      
      // Header with gradient effect
      doc.rect(0, 0, doc.page.width, 120).fill('#6366f1');
      
      doc.fontSize(32).fillColor('#FFFFFF').font('Helvetica-Bold')
         .text('LAVIAL', 50, 40);
      
      doc.fontSize(14).fillColor('#E0E7FF').font('Helvetica')
         .text('Premium Coach Journeys', 50, 80);
      
      // Ticket title
      doc.fontSize(24).fillColor('#111827').font('Helvetica-Bold')
         .text('Your Ticket', 50, 150);
      
      // Ticket ID
      doc.fontSize(12).fillColor('#6B7280').font('Helvetica')
         .text(`Ticket ID: ${ticket.ticketId}`, 50, 185);
      
      doc.fontSize(12).fillColor('#6B7280')
         .text(`Booking ID: ${booking.bookingId}`, 50, 205);
      
      // Journey details box
      const boxY = 240;
      doc.roundedRect(50, boxY, doc.page.width - 100, 180, 10)
         .lineWidth(2)
         .strokeColor('#E5E7EB')
         .stroke();
      
      // Route
      doc.fontSize(18).fillColor('#111827').font('Helvetica-Bold')
         .text(`${ticket.from} → ${ticket.to}`, 70, boxY + 20);
      
      // Date
      doc.fontSize(14).fillColor('#6B7280').font('Helvetica')
         .text('Date:', 70, boxY + 60);
      doc.fontSize(14).fillColor('#111827').font('Helvetica-Bold')
         .text(new Date(ticket.date).toLocaleDateString('en-GB'), 160, boxY + 60);
      
      // Departure
      doc.fontSize(14).fillColor('#6B7280').font('Helvetica')
         .text('Departure:', 70, boxY + 90);
      doc.fontSize(14).fillColor('#111827').font('Helvetica-Bold')
         .text(ticket.departureTime, 160, boxY + 90);
      
      // Arrival
      doc.fontSize(14).fillColor('#6B7280').font('Helvetica')
         .text('Arrival:', 70, boxY + 120);
      doc.fontSize(14).fillColor('#111827').font('Helvetica-Bold')
         .text(ticket.arrivalTime, 160, boxY + 120);
      
      // Passenger details
      const passengerY = 460;
      doc.fontSize(16).fillColor('#111827').font('Helvetica-Bold')
         .text('Passenger Details', 50, passengerY);
      
      doc.fontSize(14).fillColor('#6B7280').font('Helvetica')
         .text('Name:', 50, passengerY + 35);
      doc.fontSize(14).fillColor('#111827').font('Helvetica-Bold')
         .text(ticket.passengerName, 150, passengerY + 35);
      
      doc.fontSize(14).fillColor('#6B7280').font('Helvetica')
         .text('Email:', 50, passengerY + 65);
      doc.fontSize(14).fillColor('#111827').font('Helvetica')
         .text(booking.passenger.email, 150, passengerY + 65);
      
      doc.fontSize(14).fillColor('#6B7280').font('Helvetica')
         .text('Phone:', 50, passengerY + 95);
      doc.fontSize(14).fillColor('#111827').font('Helvetica')
         .text(booking.passenger.phone, 150, passengerY + 95);
      
      // Price
      doc.fontSize(14).fillColor('#6B7280').font('Helvetica')
         .text('Total Paid:', 50, passengerY + 125);
      doc.fontSize(18).fillColor('#16A34A').font('Helvetica-Bold')
         .text(`${ticket.price.toFixed(2)} RON`, 150, passengerY + 122);
      
      // QR Code
      doc.fontSize(16).fillColor('#111827').font('Helvetica-Bold')
         .text('Boarding Pass', 380, 450);
      
      doc.image(qrCodeDataUrl, 370, 490, { width: 150, height: 150 });
      
      doc.fontSize(10).fillColor('#6B7280').font('Helvetica')
         .text('Present this QR code when boarding', 350, 655, { width: 200, align: 'center' });
      
      // Footer
      doc.fontSize(10).fillColor('#9CA3AF').font('Helvetica')
         .text('Thank you for choosing Lavial. Have a pleasant journey!', 50, 730, {
           width: doc.page.width - 100,
           align: 'center'
         });
      
      doc.fontSize(8).fillColor('#D1D5DB')
         .text('For support: support@lavial.com | www.lavial.com', 50, 760, {
           width: doc.page.width - 100,
           align: 'center'
         });
      
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// Send ticket email
export async function sendTicketEmail(
  email: string,
  name: string,
  ticket: ITicket,
  booking: IBooking,
  pdfBuffer: Buffer
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@lavial.com',
    to: email,
    subject: `Your Lavial Ticket - ${ticket.from} to ${ticket.to}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #6366f1 0%, #818cf8 100%); 
                    color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .ticket-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; 
                        border: 2px solid #e5e7eb; }
          .route { font-size: 24px; font-weight: bold; color: #111827; margin-bottom: 15px; }
          .detail { margin: 10px 0; }
          .label { color: #6b7280; display: inline-block; width: 120px; }
          .value { color: #111827; font-weight: 600; }
          .footer { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 30px; }
          .button { background: #6366f1; color: white; padding: 12px 30px; text-decoration: none;
                    border-radius: 6px; display: inline-block; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">🚌 LAVIAL</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Premium Coach Journeys</p>
          </div>
          
          <div class="content">
            <h2 style="color: #111827;">Hello ${name}! 👋</h2>
            <p>Thank you for booking with Lavial. Your ticket is ready!</p>
            
            <div class="ticket-box">
              <div class="route">${ticket.from} → ${ticket.to}</div>
              
              <div class="detail">
                <span class="label">Ticket ID:</span>
                <span class="value">${ticket.ticketId}</span>
              </div>
              
              <div class="detail">
                <span class="label">Date:</span>
                <span class="value">${new Date(ticket.date).toLocaleDateString('en-GB')}</span>
              </div>
              
              <div class="detail">
                <span class="label">Departure:</span>
                <span class="value">${ticket.departureTime}</span>
              </div>
              
              <div class="detail">
                <span class="label">Arrival:</span>
                <span class="value">${ticket.arrivalTime}</span>
              </div>
              
              <div class="detail">
                <span class="label">Passenger:</span>
                <span class="value">${ticket.passengerName}</span>
              </div>
              
              <div class="detail">
                <span class="label">Total Paid:</span>
                <span class="value" style="color: #16a34a; font-size: 18px;">${ticket.price.toFixed(2)} RON</span>
              </div>
            </div>
            
            <p><strong>Important:</strong></p>
            <ul>
              <li>Please arrive at the station 15 minutes before departure</li>
              <li>Your PDF ticket with QR code is attached to this email</li>
              <li>Present the QR code when boarding the bus</li>
              <li>Keep this email for your records</li>
            </ul>
            
            <p>Have a pleasant journey! 🎉</p>
            
            <div class="footer">
              <p>Need help? Contact us at support@lavial.com</p>
              <p>© ${new Date().getFullYear()} Lavial. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    attachments: [
      {
        filename: `lavial-ticket-${ticket.ticketId}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  };
  
  await transporter.sendMail(mailOptions);
  console.log(`✉️  Ticket email sent to ${email}`);
}