// sheets.js — Integração com Google Sheets (via Apps Script Web App)
// -----------------------------------------------------------------
// 1) No Google Apps Script, publique como Web App (Acessível a: qualquer pessoa com o link)
// 2) Cole a URL do Web App abaixo na constante SHEETS_WEBAPP_URL
// 3) Garanta que o cabeçalho da planilha corresponde exatamente aos textos em SHEETS_HEADERS

const SHEETS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwedYyHDBtO6Vio6bGQ5obLL4kPoY0myQKn8mVQxCcbYIHslbvEDl7_bBwafZJCv5RKZw/exec';

// Cabeçalhos (exclui a coluna do Carimbo de data/hora, que será preenchida no servidor)
const SHEETS_HEADERS = [
  'Qual espécie de pet você possui?',
  'Quantos pets você possui?',
  'Como você costuma gerenciar as informações de cuidado (vacinas, remédios, banho, tosa, etc.) do seu pet?',
  'No seu dia a dia, você já utiliza algum aplicativo para gerenciar cuidado? Apps como Strava, RunKeeper e outros. Já usou algum, similar, para o seu pet?',
  'Qual destes desafios é o prioritário na gestão do seu pet? (Selecione em ordem de prioridade, do mais ao menos crítico, sendo 1 mais e 4 o menos prioritário). [Esquecer horários de medicação ou reforços de vacina (Saúde)]',
  'Qual destes desafios é o prioritário na gestão do seu pet? (Selecione em ordem de prioridade, do mais ao menos crítico, sendo 1 mais e 4 o menos prioritário). [Perder documentos ou não tê-los em mãos]',
  'Qual destes desafios é o prioritário na gestão do seu pet? (Selecione em ordem de prioridade, do mais ao menos crítico, sendo 1 mais e 4 o menos prioritário). [Dificuldade em controlar a dieta e o peso ideal do pet]',
  'Qual destes desafios é o prioritário na gestão do seu pet? (Selecione em ordem de prioridade, do mais ao menos crítico, sendo 1 mais e 4 o menos prioritário). [Falta de segurança sobre o paradeiro ou bem-estar do pet]',
  'De 1 a 5, quão importante é ter um Prontuário Veterinário Digital centralizado (com histórico, exames e receitas)?',
  'De 1 a 5, quão útil seria um lembrete automático (notificação) para a medicação, reforço de vacinas ou outra necessidade de saúde?',
  'Você faria upload de documentos importantes/legais do seu pet (RG, documentos de viagem) em um aplicativo seguro?',
  'Hoje, o que é mais trabalhoso ou que demanda mais tempo seu no cuidado do pet? Pode escrever que vamos ler.',
  'Um auxílio com a nutrição do seu pet é algo que você considera que seria importante no aplicativo? (sugestão de dieta/horários com base em peso, idade e altura do pet, etc.)?',
  'Se o aplicativo oferecesse uma Coleira Inteligente com GPS (Localização e Atividade), você consideraria comprar e usar junto com o app?',
  'A funcionalidade, gratuita, de Carteira de Identidade do Pet é um atrativo que importaria na hora de adotar o aplicativo?',
  'Se você pudesse escolher somente uma característica que te faria usar o aplicativo, qual seria? Conte para nós, estamos curiosos.',
  'Se o aplicativo básico (Carteira de Identidade e Registro Básico do Pet) fosse gratuito, você pagaria por uma assinatura mensal para ter outras funcionalidades (lembretes, histórico de saúde, dicas de cuidado, etc.)?',
  'Qual seria o valor máximo mensal (em R$) que você pagaria por essa versão?',
  'E para encerrar, se estivesse utilizando um aplicativo como este, o que faria você deixar de usá-lo?'
];

let __sheetsSending = false;

function getCheckedValues(name) {
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(el => el.value);
}

function mapFormToPayload(form) {
  const fd = new FormData(form);
  const data = {};
  for (const [k, v] of fd.entries()) {
    if (k in data) {
      if (Array.isArray(data[k])) data[k].push(v); else data[k] = [data[k], v];
    } else {
      data[k] = v;
    }
  }

  // Normalizações específicas
  // 1) Espécie (checkbox múltiplo)
  const especiesMarcadas = getCheckedValues('especie');
  const especieStr = especiesMarcadas.join(', ');

  // 2) Gestão — concatena "Outro" quando aplicável
  const gestaoStr = data.gestao_cuidado === 'Outro' && data.gestao_cuidado_outro
    ? `${data.gestao_cuidado} — ${data.gestao_cuidado_outro}`
    : (data.gestao_cuidado || '');

  // 3) Usa app geral — seu formulário pode ter name "usa_app_geral" ou "usa_app"; cobrimos ambos
  const usaAppGeral = data.usa_app_geral || data.usa_app || '';

  // 4) Valor assinatura — concatena "Outro"
  const valorAssin = data.valor_assinatura === 'Outro' && data.valor_assinatura_outro
    ? `${data.valor_assinatura} — ${data.valor_assinatura_outro}`
    : (data.valor_assinatura || '');

  // Monta objeto com chaves exatamente iguais aos cabeçalhos
  const payload = {
    [SHEETS_HEADERS[0]]: especieStr,
    [SHEETS_HEADERS[1]]: data.qtd_pets || '',
    [SHEETS_HEADERS[2]]: gestaoStr,
    [SHEETS_HEADERS[3]]: usaAppGeral,
    [SHEETS_HEADERS[4]]: data.rank_saude || '',
    [SHEETS_HEADERS[5]]: data.rank_documentos || '',
    [SHEETS_HEADERS[6]]: data.rank_dieta || '',
    [SHEETS_HEADERS[7]]: data.rank_seguranca || '',
    [SHEETS_HEADERS[8]]: data.prontuario_importancia || '',
    [SHEETS_HEADERS[9]]: data.lembrete_utilidade || '',
    [SHEETS_HEADERS[10]]: data.upload_docs || '',
    [SHEETS_HEADERS[11]]: data.tarefa_mais_trabalhosa || '',
    [SHEETS_HEADERS[12]]: data.ajuda_nutricao || '',
    [SHEETS_HEADERS[13]]: data.coleira_gps || '',
    [SHEETS_HEADERS[14]]: data.carteira_id_pet || '',
    [SHEETS_HEADERS[15]]: data.unica_caracteristica || '',
    [SHEETS_HEADERS[16]]: data.pagaria_assinatura || '',
    [SHEETS_HEADERS[17]]: valorAssin,
    [SHEETS_HEADERS[18]]: data.motivo_abandono || ''
  };

  return payload;
}

async function sendToSheets(payload) {
  if (!SHEETS_WEBAPP_URL) {
    console.warn('[Sheets] SHEETS_WEBAPP_URL não configurada. Envio ignorado.');
    return { ok: false, skipped: true };
  }
  const body = new URLSearchParams(payload);
  const resp = await fetch(SHEETS_WEBAPP_URL, { method: 'POST', body });
  const text = await resp.text();
  try {
    return { ok: resp.ok, status: resp.status, data: JSON.parse(text) };
  } catch (e) {
    return { ok: resp.ok, status: resp.status, raw: text };
  }
}
