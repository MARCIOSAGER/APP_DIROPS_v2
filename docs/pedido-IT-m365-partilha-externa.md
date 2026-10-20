# Pedido ao IT da SGA: registo de aplicação no Microsoft 365 para o DIROPS

**Assunto:** Partilha de documentos do DIROPS com entidades externas (auditores, ANAC) através do SharePoint Online da SGA
**Solicitante:** Marcio Sager, DIROPS (Direcção de Operações)
**Data:** 28/09/2026
**Esforço estimado do IT:** cerca de 30 minutos, tudo no portal

---

## 1. Contexto

O DIROPS é o sistema de gestão operacional da Direcção de Operações. Corre no servidor interno SRVKMS001 (10.1.65.45) e guarda a documentação dos aeroportos (manuais, procedimentos, certificações) num arquivo próprio. Esse servidor não é, nem deve ser, acessível a partir da internet.

Precisamos de entregar documentos a entidades externas sem acesso à rede da SGA (auditores externos, ANAC). A solução proposta usa o SharePoint Online que a SGA já tem: o DIROPS copia o documento para um site SharePoint dedicado e gera um link com validade. O servidor interno continua fechado.

Já verificámos que:

- o tenant da SGA tem licenças Microsoft 365 E3, que incluem SharePoint Online;
- a política de partilha do tenant permite links "Qualquer pessoa com o link" (testado em 28/09/2026 com uma pasta de teste no OneDrive da conta oaeroportos@sga.co.ao);
- o servidor SRVKMS001 chega aos endereços `login.microsoftonline.com` e `graph.microsoft.com` na porta 443.

Falta apenas dar ao DIROPS uma identidade própria no Microsoft 365, o que exige um administrador do tenant.

## 2. O que pedimos

### A. Registar uma aplicação no Entra ID

Entra admin center, Identity, Applications, App registrations, New registration:

| Campo | Valor |
|---|---|
| Name | `DIROPS-SGA GED` |
| Supported account types | Accounts in this organizational directory only (single tenant) |
| Redirect URI | nenhum |

Entregar-nos o **Application (client) ID**. O tenant ID já é conhecido: `603056b3-ff42-4482-b9d3-dcbe9b2d93b6`.

### B. Criar a credencial da aplicação

Certificates & secrets, Client secrets, New client secret, descrição `DIROPS SRVKMS001`, validade **24 meses**. Entregar-nos o **valor** do segredo por canal seguro, com a data de expiração.

Alternativa mais segura, se o IT preferir: nós geramos um certificado no SRVKMS001 e entregamos o ficheiro `.cer` para carregar em "Certificates". Não há segredo em texto.

### C. Permissão mínima e consentimento

API permissions, Add a permission, Microsoft Graph, **Application permissions**, `Sites.Selected`. Depois **Grant admin consent**.

Com `Sites.Selected` a aplicação não tem acesso a nada por defeito. Só ao site que for autorizado no passo E.

### D. Site SharePoint dedicado (já criado)

O site já existe, criado em 28/09/2026 pela conta oaeroportos@sga.co.ao:

| Campo | Valor |
|---|---|
| Tipo | Site de comunicação (sem grupo Microsoft 365) |
| Nome | `DIROPS-Partilhas` |
| URL | `https://sgacoao.sharepoint.com/sites/DIROPS-Partilhas` |
| Proprietário | oaeroportos@sga.co.ao |

O site nasceu com a partilha externa **desligada** ("Apenas pessoas na organização"), que é a predefinição do tenant para sites novos. Ao tentar partilhar um ficheiro com um email externo aparece "Você só pode compartilhar dentro da sua organização". O proprietário do site não consegue alterar isto.

Pedimos ao IT que altere, no SharePoint admin center (Sites, Active sites, DIROPS-Partilhas, Settings, External sharing), o nível de partilha externa do site para **Qualquer pessoa** (preferido) ou, no mínimo, **Convidados novos e existentes**. O tenant já permite "Qualquer pessoa" ao nível da organização (o OneDrive das contas usa-o), pelo que se trata só de alinhar este site. Se o IT quiser limitar mais, pedimos que aplique estas definições ao site em vez de fechar a partilha: validade máxima dos links de 30 dias e links anónimos só de visualização.

### E. Autorizar a aplicação nesse site

Passo obrigatório com `Sites.Selected`. Uma de duas formas, por um administrador do SharePoint:

**PnP PowerShell:**

```powershell
Connect-PnPOnline -Url https://sgacoao-admin.sharepoint.com -Interactive
Grant-PnPAzureADAppSitePermission -AppId "<CLIENT_ID>" -DisplayName "DIROPS-SGA GED" `
  -Site "https://sgacoao.sharepoint.com/sites/DIROPS-Partilhas" -Permissions Write
```

**Microsoft Graph (Graph Explorer, com conta de administrador):**

```
GET  https://graph.microsoft.com/v1.0/sites/sgacoao.sharepoint.com:/sites/DIROPS-Partilhas
     (copiar o campo "id")

POST https://graph.microsoft.com/v1.0/sites/<SITE_ID>/permissions
{
  "roles": ["write"],
  "grantedToIdentities": [
    { "application": { "id": "<CLIENT_ID>", "displayName": "DIROPS-SGA GED" } }
  ]
}
```

## 3. O que a aplicação faz e o que não faz

- Copia um documento (ou uma pasta) do arquivo do DIROPS para a biblioteca do site `DIROPS-Partilhas`.
- Pede ao SharePoint um link de partilha com validade (7 a 30 dias) e, quando disponível, senha.
- Apaga a cópia quando o link expira ou é revogado pelo utilizador no DIROPS.
- Documentos classificados como "secreto" nunca saem do servidor interno.
- Não lê caixas de correio, OneDrives pessoais nem outros sites. Não cria nem altera utilizadores.

## 4. Segurança, para avaliação do IT

- **Sem conta de utilizador.** Não há senha partilhada nem MFA a contornar. As políticas de acesso condicional de utilizadores não são afectadas.
- **Âmbito mínimo.** `Sites.Selected` limita o acesso a um único site, autorizado explicitamente pelo IT.
- **Revogação imediata.** Basta apagar o segredo ou a aplicação no Entra.
- **Rastreabilidade.** Os acessos da aplicação ficam nos logs de sign-in do Entra (service principal). Os acessos aos links ficam na auditoria do SharePoint. O DIROPS regista quem criou e revogou cada link.
- **Rede.** O SRVKMS001 só fala com `login.microsoftonline.com` e `graph.microsoft.com`, em HTTPS. Nada entra do exterior.
- **Rotação.** O segredo expira em 24 meses. O DIROPS mantém o lembrete e pede a renovação com antecedência.

## 5. O que precisamos de receber

1. Application (client) ID
2. Valor do segredo (ou confirmação do certificado carregado) e data de expiração
3. Confirmação do consentimento de administrador a `Sites.Selected`
4. Confirmação da autorização da aplicação no site `DIROPS-Partilhas` (passo E)
5. Nível de partilha externa confirmado ou ajustado no site (passo D)

Com estes dados o DIROPS faz um teste ponta a ponta (copiar um ficheiro de teste, gerar link, abrir de fora, apagar) antes de activar a funcionalidade para os utilizadores.
