import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";

type SendEmailBody = {
  to: string[];
  csvBase64: string;
  filename: string;
};

export async function POST(request: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const body: SendEmailBody = await request.json();
  const { to, csvBase64, filename } = body;

  if (!to?.length || !csvBase64 || !filename) {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const from = process.env.RESEND_FROM_EMAIL ?? "GoProvisions <onboarding@resend.dev>";

  const { error } = await resend.emails.send({
    from,
    to,
    subject: `Provisionen Export – ${filename}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;color:#333;">
        <h2 style="margin-bottom:8px;">Provisionen Export</h2>
        <p>Im Anhang finden Sie den CSV-Export der Provisionen des Vormonats.</p>
        <p><strong>Datei:</strong> ${filename}</p>
      </div>
    `,
    attachments: [{ filename, content: csvBase64 }],
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
