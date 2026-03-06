import { createClientFromRequest } from "npm:@base44/sdk@0.8.4";
import { PDFDocument, rgb, StandardFonts } from "npm:pdf-lib@1.17.1";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401 });
    }

    const body = await req.json();
    const { documento_id } = body;

    if (!documento_id) {
      return new Response(JSON.stringify({ error: "ID obrigatório" }), { status: 400 });
    }

    // Buscar documento
    const docs = await base44.asServiceRole.entities.Documento.filter({ id: documento_id });
    const documento = docs[0];
    
    if (!documento) {
      return new Response(JSON.stringify({ error: "Documento não encontrado" }), { status: 404 });
    }

    // URL do arquivo
    let fileUrl = documento.arquivo_url;
    if (documento.arquivo_privado_uri) {
      const result = await base44.integrations.Core.CreateFileSignedUrl({
        file_uri: documento.arquivo_privado_uri,
        expires_in: 300,
      });
      fileUrl = result.signed_url;
    }

    // Baixar PDF
    const pdfResponse = await fetch(fileUrl);
    if (!pdfResponse.ok) {
      return new Response(JSON.stringify({ error: "Erro ao baixar" }), { status: 500 });
    }

    const pdfBytes = await pdfResponse.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const dataHora = new Date().toLocaleString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const nomeUsuario = user.full_name || user.email || "Utilizador";
    const marcaRodape = `CONFIDENCIAL - ${nomeUsuario} - ${dataHora}`;

    // Adicionar marca em todas as páginas
    const pages = pdfDoc.getPages();
    for (const page of pages) {
      const { width, height } = page.getSize();

      // Rodapé
      page.drawText(marcaRodape, {
        x: 40,
        y: 20,
        size: 8,
        font: font,
        color: rgb(0.3, 0.3, 0.3),
      });

      // Centro (SEM rotação por enquanto)
      page.drawText(nomeUsuario.toUpperCase(), {
        x: width / 2 - 100,
        y: height / 2,
        size: 50,
        font: font,
        color: rgb(0.8, 0.8, 0.8),
        opacity: 0.3,
      });
    }

    const modifiedPdfBytes = await pdfDoc.save();

    // Registrar log
    await base44.asServiceRole.entities.LogAcessoDocumento.create({
      documento_id,
      usuario_email: user.email,
      usuario_nome: user.full_name || user.email,
      tipo_acesso: "download",
      ip_address: req.headers.get("cf-connecting-ip") || "unknown",
      data_hora_acesso: new Date().toISOString(),
    });

    // Retornar PDF
    return new Response(modifiedPdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${documento.titulo}.pdf"`,
      },
    });

  } catch (error) {
    console.error("Erro:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});