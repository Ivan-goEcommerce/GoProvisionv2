import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";

type SendEmailBody = {
  to: string[];
  csvBase64: string;
  filename: string;
};

export async function POST(request: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "E-Mail-Versand nicht konfiguriert. RESEND_API_KEY fehlt." },
      { status: 500 },
    );
  }
  if (!process.env.RESEND_FROM_EMAIL) {
    return NextResponse.json(
      { error: "E-Mail-Versand nicht konfiguriert. RESEND_FROM_EMAIL fehlt." },
      { status: 500 },
    );
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  let body: SendEmailBody;
  try {
    body = await request.json() as SendEmailBody;
  } catch {
    return NextResponse.json({ error: "Ungültiges Anfrage-Format." }, { status: 400 });
  }

  const { to, csvBase64, filename } = body;

  if (!to?.length) {
    return NextResponse.json({ error: "Keine Empfänger angegeben." }, { status: 400 });
  }
  if (!csvBase64) {
    return NextResponse.json({ error: "CSV-Inhalt fehlt." }, { status: 400 });
  }
  if (!filename) {
    return NextResponse.json({ error: "Dateiname fehlt." }, { status: 400 });
  }

  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
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
    return NextResponse.json(
      { error: `Resend-Fehler: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, id: data?.id });
}
