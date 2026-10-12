// Existing operational controller, now scoped to its SPA module.
export default function mount(document, location, window) {
// =========================================================

// WashSense — Financeiro

// Supabase + Assinatura + Pagamentos + PIX + Boleto Asaas

// =========================================================



const SUPABASE_URL = window.WASHSENSE_SUPABASE.url;



const SUPABASE_ANON_KEY = window.WASHSENSE_SUPABASE.anonKey;



const supabaseClient =

  window.washsenseSupabase;





// =========================================================

// ELEMENTOS

// =========================================================



const paymentRows =

  document.getElementById('paymentRows');



const historyFilter =

  document.getElementById('historyFilter');



const currentMethod =

  document.getElementById('currentMethod');



const plansSection =

  document.getElementById('plansSection');



const changePlanButton =

  document.getElementById('changePlan');



const changeMethodButton =

  document.getElementById('changeMethod');



const payNowButton =

  document.getElementById('payNow');



const billingModal =

  document.getElementById('billingModal');



const modalBody =

  document.getElementById('modalBody');



const modalTitle =

  document.getElementById('modalTitle');



const closeModalButton =

  document.getElementById('closeModal');



const cancelModalButton =

  document.getElementById('cancelModal');



const confirmModalButton =

  document.getElementById('confirmModal');





// =========================================================

// ESTADO

// =========================================================



let organizationId = null;

let subscription = null;

let payments = [];



let pixPollingTimer = null;

let pixPollingAttempts = 0;



const PIX_POLL_INTERVAL = 3000;

const PIX_MAX_ATTEMPTS = 100;





// =========================================================

// UTILITÁRIOS

// =========================================================



function formatCardNumberField(input) {
  if (!input) return;

  const value = String(input.value || '');
  const caret = typeof input.selectionStart === 'number'
    ? input.selectionStart
    : value.length;

  // Conta quantos dígitos existiam antes do cursor. Isso permite
  // reformatar o valor sem fazer o cursor "pular" durante a digitação.
  const digitsBeforeCaret = value.slice(0, caret).replace(/\D/g, '').length;
  const digits = value.replace(/\D/g, '').slice(0, 19);

  const groups = digits.match(/.{1,4}/g) || [];
  const formatted = groups.join(' ');
  input.value = formatted;

  // Reposiciona o cursor depois do mesmo número de dígitos que havia
  // antes dele antes da máscara ser aplicada.
  let newCaret = 0;
  let countedDigits = 0;

  while (newCaret < formatted.length && countedDigits < digitsBeforeCaret) {
    if (/\d/.test(formatted[newCaret])) countedDigits++;
    newCaret++;
  }

  input.setSelectionRange(newCaret, newCaret);
}

function formatCardExpiryField(input) {
  if (!input) return;

  const value = String(input.value || '');
  const caret = typeof input.selectionStart === 'number' ? input.selectionStart : value.length;

  // Quantidade de dígitos antes do cursor, para o cursor não pular.
  const digitsBeforeCaret = value.slice(0, caret).replace(/\D/g, '').length;
  const digits = value.replace(/\D/g, '').slice(0, 4);

  let formatted = digits;
  if (digits.length > 2) {
    formatted = digits.slice(0, 2) + '/' + digits.slice(2);
  }

  input.value = formatted;

  let newCaret = 0;
  let countedDigits = 0;
  while (newCaret < formatted.length && countedDigits < digitsBeforeCaret) {
    if (/\d/.test(formatted[newCaret])) countedDigits++;
    newCaret++;
  }

  // Ao chegar aos dois primeiros dígitos, posiciona o cursor depois da barra.
  if (digitsBeforeCaret === 2 && formatted.length >= 3 && newCaret === 2) {
    newCaret = 3;
  }

  try {
    input.setSelectionRange(newCaret, newCaret);
  } catch (_) {}
}

function formatMoney(value) {

  return Number(value || 0).toLocaleString(

    'pt-BR',

    {

      style: 'currency',

      currency: 'BRL'

    }

  );

}





function formatDate(date) {

  if (!date) {

    return '—';

  }



  const d = new Date(date + 'T00:00:00');



  return d.toLocaleDateString('pt-BR');

}





function formatDateLong(date) {

  if (!date) {

    return '—';

  }



  const d = new Date(date + 'T00:00:00');



  return d.toLocaleDateString(

    'pt-BR',

    {

      day: '2-digit',

      month: 'long',

      year: 'numeric'

    }

  );

}





function formatCpfCnpj(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 14);

  if (digits.length > 11) {
    return digits
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  }

  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}


function escapeHtml(value) {

  return String(value ?? '')

    .replace(/&/g, '&amp;')

    .replace(/</g, '&lt;')

    .replace(/>/g, '&gt;')

    .replace(/"/g, '&quot;')

    .replace(/'/g, '&#039;');

}





function paymentStatusLabel(status) {

  const map = {

    RECEIVED: 'Pago',

    CONFIRMED: 'Confirmado',

    PENDING: 'Pendente',

    OVERDUE: 'Em atraso',

    REFUNDED: 'Estornado',

    REFUND_REQUESTED: 'Estorno solicitado',

    CHARGEBACK_REQUESTED: 'Contestação',

    CHARGEBACK_DISPUTE: 'Contestação',

    DUNNING_REQUESTED: 'Cobrança',

    DUNNING_RECEIVED: 'Cobrança recebida',

    AWAITING_RISK_ANALYSIS: 'Em análise'

  };



  return map[status] || status || 'Pendente';

}





function paymentStatusClass(status) {

  if (

    status === 'RECEIVED' ||

    status === 'CONFIRMED'

  ) {

    return 'status-paid';

  }



  return 'status-pending';

}





function billingTypeLabel(type) {

  const map = {

    PIX: 'PIX',

    BOLETO: 'Boleto',

    CREDIT_CARD: 'Cartão',

    UNDEFINED: 'Não definido'

  };



  return map[type] || type || '—';

}





function isPaymentPaid(payment) {

  return (

    payment?.status === 'RECEIVED' ||

    payment?.status === 'CONFIRMED'

  );

}





// =========================================================

// MODAL

// =========================================================



function openModal(title, html, action = null) {

  if (!billingModal) {

    return;

  }



  if (modalTitle) {

    modalTitle.textContent = title;

  }



  if (modalBody) {

    modalBody.innerHTML = html;

  }



  billingModal.classList.add('open');



  if (confirmModalButton) {

    confirmModalButton.style.display =

      action ? '' : 'none';



    confirmModalButton.onclick =

      action

        ? action

        : null;

  }

}





function closeModal() {

  stopPixPolling();



  billingModal?.classList.remove('open');

}





closeModalButton?.addEventListener(

  'click',

  closeModal

);





cancelModalButton?.addEventListener(

  'click',

  closeModal

);





billingModal?.addEventListener(

  'click',

  event => {

    if (event.target === billingModal) {

      closeModal();

    }

  }

);





// =========================================================

// STATUS DE CARREGAMENTO

// =========================================================



function setLoadingState() {

  const title =

    document.querySelector('.plan-title h2');



  const description =

    document.querySelector('.plan-title p');



  const price =

    document.querySelector('.price strong');



  const nextCharge =

    document.querySelector(

      '.plan-meta div:first-child strong'

    );



  const chargeDate =

    document.querySelector('.charge-date');



  const chargeValue =

    document.querySelector(

      '.charge-card > strong'

    );



  const chargeDescription =

    document.querySelector('.charge-card p');



  if (title) {

    title.textContent = 'Carregando...';

  }



  if (description) {

    description.textContent =

      'Carregando dados da sua assinatura WashSense.';

  }



  if (price) {

    price.textContent = 'R$ 0,00';

  }



  if (nextCharge) {

    nextCharge.textContent = '—';

  }



  if (currentMethod) {

    currentMethod.textContent = '—';

  }



  if (chargeDate) {

    chargeDate.innerHTML = '—';

  }



  if (chargeValue) {

    chargeValue.textContent = 'R$ 0,00';

  }



  if (chargeDescription) {

    chargeDescription.textContent =

      'Carregando próxima cobrança...';

  }

}





// =========================================================

// ORGANIZAÇÃO

// =========================================================



async function loadOrganization() {

  console.log(

    'WashSense: procurando organização do usuário...'

  );



  const {

    data: { user },

    error: userError

  } =

    await supabaseClient.auth.getUser();



  if (userError) {

    throw userError;

  }



  if (!user) {

    throw new Error(

      'Usuário não autenticado.'

    );

  }



  console.log(

    'WashSense: usuário autenticado:',

    user.id

  );



  const {

    data,

    error

  } =

    await supabaseClient

      .from('organization_members')

      .select(`

        organization_id,

        role,

        organizations (

          id,

          name

        )

      `)

      .eq(

        'user_id',

        user.id

      );



  if (error) {

    console.error(

      'WashSense: erro ao buscar organização:',

      error

    );



    throw error;

  }



  if (!data || data.length === 0) {

    throw new Error(

      'Nenhuma organização encontrada para este usuário.'

    );

  }



  const membership = data[0];



  organizationId =

    membership.organization_id;



  console.log(

    'WashSense: organização encontrada:',

    organizationId

  );



  console.log(

    'WashSense: organização:',

    membership.organizations?.name

  );



  return membership;

}





// =========================================================

// ASSINATURA

// =========================================================



async function loadSubscription() {

  console.log(

    'WashSense: carregando assinatura...'

  );



  const {

    data,

    error

  } =

    await supabaseClient

      .from('subscriptions')

      .select(`

        id,

        organization_id,

        plan_id,

        status,

        provider,

        provider_subscription_id,

        billing_cycle,

        amount,

        next_due_date,

        started_at,

        cancelled_at

      `)

      .eq(

        'organization_id',

        organizationId

      )

      .order(

        'started_at',

        {

          ascending: false

        }

      )

      .limit(1);



  if (error) {

    console.error(

      'WashSense: erro ao carregar assinatura:',

      error

    );



    throw error;

  }



  subscription =

    data?.[0] || null;



  console.log(

    'WashSense: assinatura encontrada:',

    subscription

  );



  if (!subscription) {

    return null;

  }



  let plan = null;



  if (subscription.plan_id) {

    const {

      data: planData,

      error: planError

    } =

      await supabaseClient

        .from('plans')

        .select(`

          id,

          name,

          description,

          price_monthly,

          max_units,

          max_machines,

          max_devices

        `)

        .eq(

          'id',

          subscription.plan_id

        )

        .maybeSingle();



    if (planError) {

      console.warn(

        'WashSense: não foi possível carregar o plano:',

        planError

      );

    } else {

      plan = planData;

    }

  }



  subscription.plan = plan;



  return subscription;

}





// =========================================================

// PAGAMENTOS

// =========================================================



async function loadPayments() {

  console.log(

    'WashSense: carregando pagamentos...'

  );



  const {

    data,

    error

  } =

    await supabaseClient

      .from('payments')

      .select(`

        id,

        organization_id,

        subscription_id,

        provider,

        provider_payment_id,

        amount,

        net_amount,

        payment_method,

        status,

        due_date,

        paid_at,

        receipt_url,

        invoice_url,

        description,

        external_reference,

        created_at

      `)

      .eq(

        'organization_id',

        organizationId

      )

      .order(

        'created_at',

        {

          ascending: false

        }

      );



  if (error) {

    console.error(

      'WashSense: erro ao carregar pagamentos:',

      error

    );



    throw error;

  }



  payments = data || [];



  console.log(

    'WashSense: pagamentos encontrados:',

    payments

  );



  renderPayments();

}





// =========================================================

// RECARREGAR DADOS FINANCEIROS

// =========================================================



async function reloadFinancialData() {

  await loadSubscription();

  await loadPayments();

  renderSubscription();

}





// =========================================================

// ASSINATURA NA TELA

// =========================================================



function renderSubscription() {

  if (!subscription) {

    renderNoSubscription();

    return;

  }



  const plan =

    subscription.plan;



  const planName =

    plan?.name ||

    'Plano WashSense';



  const amount =

    subscription.amount ??

    plan?.price_monthly ??

    0;



  const status =

    subscription.status ||

    'ACTIVE';



  const nextDueDate =

    subscription.next_due_date;



  const billingPayment =

    payments.find(

      payment =>

        payment.subscription_id ===

        subscription.id

    ) ||

    payments.find(

      payment =>

        !isPaymentPaid(payment)

    );



  const billingType =

    billingPayment?.payment_method ||

    '—';



  const title =

    document.querySelector(

      '.plan-title h2'

    );



  const description =

    document.querySelector(

      '.plan-title p'

    );



  const price =

    document.querySelector(

      '.price strong'

    );



  const nextCharge =

    document.querySelector(

      '.plan-meta div:first-child strong'

    );



  const statusBadge =

    document.querySelector(

      '.plan-badge'

    );



  const subscriptionStatus =

    document.querySelector(

      '.subscription-status'

    );



  const chargeDate =

    document.querySelector(

      '.charge-date'

    );



  const chargeValue =

    document.querySelector(

      '.charge-card > strong'

    );



  const chargeDescription =

    document.querySelector(

      '.charge-card p'

    );



  if (title) {

    title.textContent =

      planName;

  }



  if (description) {

    description.textContent =

      plan?.description ||

      'Plano da sua assinatura WashSense.';

  }



  if (price) {

    price.textContent =

      formatMoney(amount);

  }



  if (nextCharge) {

    nextCharge.textContent =

      formatDate(nextDueDate);

  }



  if (currentMethod) {

    currentMethod.textContent =

      billingTypeLabel(

        billingType

      );

  }



  if (statusBadge) {

    statusBadge.textContent =

      status === 'ACTIVE'

        ? 'ATIVO'

        : status;

  }



  if (subscriptionStatus) {

    subscriptionStatus.innerHTML =

      status === 'ACTIVE'

        ? '<i></i> Assinatura ativa'

        : `<i></i> ${escapeHtml(status)}`;

  }



  if (chargeDate) {

    if (nextDueDate) {

      const date =

        new Date(

          nextDueDate + 'T00:00:00'

        );



      const day =

        String(

          date.getDate()

        ).padStart(2, '0');



      const month =

        date

          .toLocaleDateString(

            'pt-BR',

            {

              month: 'short'

            }

          )

          .replace('.', '')

          .toUpperCase();



      chargeDate.innerHTML =

        `${day} <small>${month}</small>`;

    } else {

      chargeDate.innerHTML =

        '—';

    }

  }



  if (chargeValue) {

    chargeValue.textContent =

      formatMoney(amount);

  }



  if (chargeDescription) {

    chargeDescription.textContent =

      `Plano ${planName} · próxima cobrança em ${formatDate(nextDueDate)}`;

  }





  // -------------------------------------------------------

  // DESTACAR PLANO ATUAL

  // -------------------------------------------------------



  document

    .querySelectorAll('[data-plan]')

    .forEach(button => {

      const card =

        button.closest('.mini-plan');



      if (!card) {

        return;

      }



      const selected =

        button.dataset.plan

          ?.toLowerCase() ===

        planName.toLowerCase();



      if (selected) {

        button.style.display =

          'none';

      }



      card.classList.toggle(

        'featured',

        selected

      );

    });





  // -------------------------------------------------------

  // LABEL PLANO ATUAL

  // -------------------------------------------------------



  document

    .querySelectorAll('.mini-plan')

    .forEach(card => {

      const button =

        card.querySelector(

          '[data-plan]'

        );



      if (!button) {

        return;

      }



      const name =

        button.dataset.plan;



      const isCurrent =

        name?.toLowerCase() ===

        planName.toLowerCase();



      if (isCurrent) {

        const oldLabel =

          card.querySelector(

            '.current-label'

          );



        if (!oldLabel) {

          const label =

            document.createElement(

              'span'

            );



          label.className =

            'current-label';



          label.textContent =

            'PLANO ATUAL';



          card.appendChild(label);

        }

      }

    });

}





// =========================================================

// SEM ASSINATURA

// =========================================================



function renderNoSubscription() {

  const title =

    document.querySelector(

      '.plan-title h2'

    );



  const description =

    document.querySelector(

      '.plan-title p'

    );



  const price =

    document.querySelector(

      '.price strong'

    );



  const nextCharge =

    document.querySelector(

      '.plan-meta div:first-child strong'

    );



  if (title) {

    title.textContent =

      'Nenhuma assinatura';

  }



  if (description) {

    description.textContent =

      'Nenhuma assinatura ativa foi encontrada para esta organização.';

  }



  if (price) {

    price.textContent =

      'R$ 0,00';

  }



  if (nextCharge) {

    nextCharge.textContent =

      '—';

  }



  if (currentMethod) {

    currentMethod.textContent =

      '—';

  }

}





// =========================================================

// RENDERIZAR PAGAMENTOS

// =========================================================



function renderPayments() {

  if (!paymentRows) {

    return;

  }



  const filter =

    historyFilter?.value ||

    'all';



  const filtered =

    payments.filter(payment => {

      if (filter === 'all') {

        return true;

      }



      if (filter === 'paid') {

        return isPaymentPaid(payment);

      }



      if (filter === 'pending') {

        return !isPaymentPaid(payment);

      }



      return true;

    });



  if (filtered.length === 0) {

    paymentRows.innerHTML = `

      <tr>

        <td

          colspan="6"

          style="

            text-align:center;

            padding:30px;

            color:#71849a;

          "

        >

          Nenhum pagamento encontrado.

        </td>

      </tr>

    `;



    return;

  }



  paymentRows.innerHTML =

    filtered

      .map(payment => {

        const status =

          paymentStatusLabel(

            payment.status

          );



        const statusClass =

          paymentStatusClass(

            payment.status

          );



        const method =

          billingTypeLabel(

            payment.payment_method

          );



        let documentButton = '—';



        if (payment.receipt_url) {

          documentButton = `

            <a

              class="doc-btn"

              href="${escapeHtml(payment.receipt_url)}"

              target="_blank"

              rel="noopener noreferrer"

            >

              Comprovante

            </a>

          `;

        }

        else if (payment.invoice_url) {

          documentButton = `

            <a

              class="doc-btn"

              href="${escapeHtml(payment.invoice_url)}"

              target="_blank"

              rel="noopener noreferrer"

            >

              Fatura

            </a>

          `;

        }



        return `

          <tr>



            <td>

              ${formatDate(

                payment.due_date ||

                payment.created_at?.slice(0, 10)

              )}

            </td>



            <td>

              ${escapeHtml(

                payment.description ||

                'Cobrança WashSense'

              )}

            </td>



            <td>

              <strong>

                ${formatMoney(payment.amount)}

              </strong>

            </td>



            <td>

              ${method}

            </td>



            <td>

              <span class="${statusClass}">

                ${status}

              </span>

            </td>



            <td>

              ${documentButton}

            </td>



          </tr>

        `;

      })

      .join('');

}





// =========================================================

// ENCONTRAR COBRANÇA PENDENTE

// =========================================================



function getPendingPayment() {

  if (!payments.length) {

    return null;

  }



  const pending =

    payments.find(

      payment =>

        !isPaymentPaid(payment) &&

        payment.subscription_id ===

          subscription?.id

    );



  if (pending) {

    return pending;

  }



  return payments.find(

    payment =>

      !isPaymentPaid(payment)

  ) || null;

}





// =========================================================

// GERAR PIX

// =========================================================



async function generatePix(payment) {

  if (!payment) {

    throw new Error(

      'Nenhuma cobrança pendente encontrada.'

    );

  }



  if (!payment.provider_payment_id) {

    throw new Error(

      'A cobrança não possui identificador do Asaas.'

    );

  }



  console.log(

    'WashSense: solicitando PIX:',

    payment.provider_payment_id

  );



  const {

    data: {

      session

    }

  } =

    await supabaseClient.auth.getSession();



  if (!session) {

    throw new Error(

      'Sua sessão expirou. Faça login novamente.'

    );

  }



  const response =

    await fetch(

      `${SUPABASE_URL}/functions/v1/asaas-get-pix`,

      {

        method: 'POST',



        headers: {

          'Authorization':

            `Bearer ${session.access_token}`,



          'apikey':

            SUPABASE_ANON_KEY,



          'Content-Type':

            'application/json'

        },



        body: JSON.stringify({

          paymentId:

            payment.provider_payment_id

        })

      }

    );



  const result =

    await response.json();



  console.log(

    'WashSense: resposta do asaas-get-pix:',

    result

  );



  if (!response.ok) {

    throw new Error(

      result?.error ||

      'Não foi possível gerar o PIX.'

    );

  }



  if (

    !result?.encodedImage ||

    !result?.payload

  ) {

    throw new Error(

      'O Asaas não retornou os dados do PIX.'

    );

  }



  return result;

}





// =========================================================

// COPIAR PIX

// =========================================================



async function copyPixPayload(payload) {

  try {

    await navigator.clipboard.writeText(

      payload

    );



    const button =

      document.getElementById(

        'copyPixButton'

      );



    if (button) {

      const oldText =

        button.textContent;



      button.textContent =

        'Copiado!';



      setTimeout(() => {

        button.textContent =

          oldText;

      }, 2000);

    }



    console.log(

      'WashSense: PIX copiado.'

    );



    return true;



  } catch (error) {

    console.error(

      'WashSense: erro ao copiar PIX:',

      error

    );



    alert(

      'Não foi possível copiar automaticamente. Selecione o código e copie manualmente.'

    );



    return false;

  }

}





// =========================================================

// PARAR MONITORAMENTO PIX

// =========================================================



function stopPixPolling() {

  if (pixPollingTimer) {

    clearTimeout(

      pixPollingTimer

    );



    pixPollingTimer = null;

  }



  pixPollingAttempts = 0;

}





// =========================================================

// VERIFICAR PAGAMENTO NO SUPABASE

// =========================================================



async function checkPaymentStatus(

  providerPaymentId

) {

  const {

    data,

    error

  } =

    await supabaseClient

      .from('payments')

      .select(`

        id,

        provider_payment_id,

        amount,

        status,

        payment_method,

        due_date,

        paid_at,

        receipt_url,

        invoice_url,

        description,

        subscription_id

      `)

      .eq(

        'organization_id',

        organizationId

      )

      .eq(

        'provider_payment_id',

        providerPaymentId

      )

      .maybeSingle();



  if (error) {

    console.error(

      'WashSense: erro verificando pagamento:',

      error

    );



    throw error;

  }



  return data;

}





// =========================================================

// MONITORAR PAGAMENTO PIX

// =========================================================



function startPixPolling(

  providerPaymentId

) {

  stopPixPolling();



  pixPollingAttempts = 0;



  async function poll() {

    pixPollingAttempts++;



    try {

      console.log(

        `WashSense: verificando PIX (${pixPollingAttempts}/${PIX_MAX_ATTEMPTS})`

      );



      const payment =

        await checkPaymentStatus(

          providerPaymentId

        );



      if (payment) {

        const status =

          payment.status;



        console.log(

          'WashSense: status do pagamento:',

          status

        );



        if (

          status === 'RECEIVED' ||

          status === 'CONFIRMED'

        ) {

          await handlePaymentConfirmed(

            payment

          );



          return;

        }



        if (status === 'OVERDUE') {

          showPixOverdue();



          return;

        }

      }



      if (

        pixPollingAttempts <

        PIX_MAX_ATTEMPTS

      ) {

        pixPollingTimer =

          setTimeout(

            poll,

            PIX_POLL_INTERVAL

          );

      }

      else {

        showPixTimeout();

      }



    } catch (error) {

      console.error(

        'WashSense: erro no monitoramento PIX:',

        error

      );



      if (

        pixPollingAttempts <

        PIX_MAX_ATTEMPTS

      ) {

        pixPollingTimer =

          setTimeout(

            poll,

            PIX_POLL_INTERVAL

          );

      }

    }

  }



  poll();

}





// =========================================================

// PAGAMENTO CONFIRMADO

// =========================================================



async function handlePaymentConfirmed(

  payment

) {

  stopPixPolling();



  console.log(

    'WashSense: pagamento confirmado:',

    payment

  );



  if (modalTitle) {

    modalTitle.textContent =

      'Pagamento confirmado';

  }



  if (modalBody) {

    modalBody.innerHTML = `

      <div

        style="

          text-align:center;

          padding:20px 5px;

        "

      >



        <div

          style="

            width:72px;

            height:72px;

            margin:0 auto 18px;

            border-radius:50%;

            display:flex;

            align-items:center;

            justify-content:center;

            background:#e8f8ef;

            color:#1e9b5a;

            font-size:38px;

            font-weight:700;

          "

        >

          ✓

        </div>



        <h3

          style="

            margin:0 0 10px;

            color:#102a43;

            font-size:22px;

          "

        >

          Pagamento recebido!

        </h3>



        <p

          style="

            margin:0 0 8px;

            color:#71849a;

          "

        >

          Recebemos o pagamento de

          <strong>

            ${formatMoney(payment.amount)}

          </strong>.

        </p>



        <p

          style="

            margin:0;

            color:#71849a;

            font-size:13px;

          "

        >

          Sua assinatura WashSense foi atualizada automaticamente.

        </p>



      </div>

    `;

  }



  if (confirmModalButton) {

    confirmModalButton.style.display =

      '';



    confirmModalButton.textContent =

      'Fechar';



    confirmModalButton.onclick =

      async () => {

        closeModal();



        try {

          await reloadFinancialData();

        } catch (error) {

          console.error(

            'WashSense: erro atualizando financeiro:',

            error

          );

        }

      };

  }



  try {

    await reloadFinancialData();

  } catch (error) {

    console.error(

      'WashSense: erro após pagamento confirmado:',

      error

    );

  }

}





// =========================================================

// PIX EXPIRADO / TIMEOUT

// =========================================================



function showPixOverdue() {

  stopPixPolling();



  if (modalTitle) {

    modalTitle.textContent =

      'Pagamento em atraso';

  }



  if (modalBody) {

    modalBody.innerHTML = `

      <div

        style="

          text-align:center;

          padding:20px;

        "

      >



        <h3

          style="

            color:#c0392b;

            margin-bottom:10px;

          "

        >

          Esta cobrança está em atraso.

        </h3>



        <p

          style="

            color:#71849a;

          "

        >

          Gere uma nova cobrança ou entre em contato com o suporte.

        </p>



      </div>

    `;

  }



  if (confirmModalButton) {

    confirmModalButton.style.display =

      '';



    confirmModalButton.textContent =

      'Fechar';



    confirmModalButton.onclick =

      closeModal;

  }

}





function showPixTimeout() {

  stopPixPolling();



  const statusElement =

    document.getElementById(

      'pixPaymentStatus'

    );



  if (statusElement) {

    statusElement.innerHTML = `

      <span>

        Ainda aguardando confirmação do pagamento.

      </span>

      <br>

      <small>

        Você pode fechar esta janela. O pagamento continuará sendo atualizado pelo sistema.

      </small>

    `;

  }

}





// =========================================================

// ABRIR MODAL PIX

// =========================================================



async function openPixPayment(

  payment

) {

  stopPixPolling();



  openModal(

    'Pagamento via PIX',

    `

      <div

        style="

          text-align:center;

          padding:20px;

        "

      >

        <div

          style="

            width:48px;

            height:48px;

            margin:0 auto 15px;

            border:4px solid #e8eef5;

            border-top-color:#0b63ce;

            border-radius:50%;

            animation:washsense-spin 1s linear infinite;

          "

        ></div>



        <p

          style="

            color:#71849a;

            margin:0;

          "

        >

          Gerando seu pagamento PIX...

        </p>

      </div>

    `,

    null

  );



  if (confirmModalButton) {

    confirmModalButton.style.display =

      'none';

  }



  try {

    const pix =

      await generatePix(payment);



    const encodedImage =

      pix.encodedImage;



    const payload =

      pix.payload;



    const expirationDate =

      pix.expirationDate;



    const amount =

      pix.amount ??

      payment.amount;



    if (modalTitle) {

      modalTitle.textContent =

        'Pagamento via PIX';

    }



    if (modalBody) {

      modalBody.innerHTML = `

        <div

          style="

            text-align:center;

          "

        >



          <div

            style="

              font-size:13px;

              color:#71849a;

              margin-bottom:4px;

            "

          >

            ${escapeHtml(

              pix.description ||

              payment.description ||

              'WashSense'

            )}

          </div>



          <div

            style="

              font-size:24px;

              font-weight:700;

              color:#102a43;

              margin-bottom:14px;

            "

          >

            ${formatMoney(amount)}

          </div>



          <p

            style="

              margin:0 0 12px;

              color:#536b82;

              font-size:13px;

            "

          >

            Escaneie o QR Code com o aplicativo do seu banco

          </p>



          <div

            style="

              width:220px;

              height:220px;

              margin:0 auto 16px;

              padding:10px;

              border:1px solid #dbe5ef;

              border-radius:12px;

              background:#fff;

              box-sizing:border-box;

            "

          >

            <img

              src="data:image/png;base64,${encodedImage}"

              alt="QR Code PIX"

              style="

                width:100%;

                height:100%;

                object-fit:contain;

                display:block;

              "

            >

          </div>



          <div

            style="

              text-align:left;

              margin-top:10px;

            "

          >



            <label

              style="

                display:block;

                font-size:12px;

                color:#71849a;

                margin-bottom:6px;

              "

            >

              PIX copia e cola

            </label>



            <div

              style="

                display:flex;

                gap:8px;

                align-items:stretch;

              "

            >



              <input

                id="pixPayloadInput"

                type="text"

                value="${escapeHtml(payload)}"

                readonly

                style="

                  flex:1;

                  min-width:0;

                  border:1px solid #dbe5ef;

                  border-radius:8px;

                  padding:11px;

                  font-size:11px;

                  color:#536b82;

                  background:#f8fafc;

                  box-sizing:border-box;

                "

              >



              <button

                id="copyPixButton"

                type="button"

                style="

                  border:0;

                  background:#0b315b;

                  color:#fff;

                  border-radius:8px;

                  padding:0 16px;

                  cursor:pointer;

                  font-weight:600;

                "

              >

                Copiar

              </button>



            </div>



          </div>



          ${

            expirationDate

              ? `

                <div

                  style="

                    margin-top:12px;

                    font-size:12px;

                    color:#71849a;

                  "

                >

                  Validade do PIX:

                  ${formatPixDateTime(

                    expirationDate

                  )}

                </div>

              `

              : ''

          }



          <div

            id="pixPaymentStatus"

            style="

              margin-top:16px;

              padding:11px;

              border-radius:8px;

              background:#f1f7fd;

              color:#41617d;

              font-size:12px;

            "

          >

            <strong>

              Aguardando pagamento...

            </strong>

            <br>

            Após o pagamento, o status será atualizado automaticamente.

          </div>



        </div>

      `;



      document

        .getElementById(

          'copyPixButton'

        )

        ?.addEventListener(

          'click',

          () =>

            copyPixPayload(

              payload

            )

        );



      document

        .getElementById(

          'pixPayloadInput'

        )

        ?.addEventListener(

          'click',

          event => {

            event.target.select();

          }

        );

    }



    if (confirmModalButton) {

      confirmModalButton.style.display =

        '';



      confirmModalButton.textContent =

        'Fechar';



      confirmModalButton.onclick =

        closeModal;

    }



    startPixPolling(

      payment.provider_payment_id

    );



  } catch (error) {

    console.error(

      'WashSense: erro ao gerar PIX:',

      error

    );



    if (modalTitle) {

      modalTitle.textContent =

        'Não foi possível gerar o PIX';

    }



    if (modalBody) {

      modalBody.innerHTML = `

        <div

          style="

            text-align:center;

            padding:20px;

          "

        >



          <div

            style="

              font-size:42px;

              margin-bottom:12px;

            "

          >

            ⚠️

          </div>



          <h3

            style="

              margin:0 0 10px;

              color:#102a43;

            "

          >

            Não foi possível gerar o PIX

          </h3>



          <p

            style="

              color:#71849a;

              margin:0;

            "

          >

            ${escapeHtml(

              error?.message ||

              'Ocorreu um erro inesperado.'

            )}

          </p>



        </div>

      `;

    }



    if (confirmModalButton) {

      confirmModalButton.style.display =

        '';



      confirmModalButton.textContent =

        'Fechar';



      confirmModalButton.onclick =

        closeModal;

    }

  }

}





// =========================================================

// DATA/HORA DO PIX

// =========================================================



function formatPixDateTime(

  date

) {

  if (!date) {

    return '—';

  }



  const d =

    new Date(date);



  if (Number.isNaN(d.getTime())) {

    return date;

  }



  return d.toLocaleString(

    'pt-BR'

  );

}





// =========================================================

// BOLETO ASAAS

// =========================================================

async function generateBoleto(payment) {

  if (!payment) {
    throw new Error('Nenhuma cobrança pendente encontrada.');
  }

  if (!payment.provider_payment_id) {
    throw new Error('A cobrança não possui identificador do Asaas.');
  }

  console.log(
    'WashSense: solicitando boleto:',
    payment.provider_payment_id
  );

  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (!session) {
    throw new Error('Sua sessão expirou. Faça login novamente.');
  }

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/asaas-get-boleto`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        paymentId: payment.provider_payment_id
      })
    }
  );

  const result = await response.json();

  console.log(
    'WashSense: resposta do asaas-get-boleto:',
    result
  );

  if (!response.ok) {
    throw new Error(
      result?.error || 'Não foi possível carregar o boleto.'
    );
  }

  if (!result?.bankSlipUrl) {
    throw new Error('O Asaas não retornou o PDF do boleto.');
  }

  return result;
}



async function copyBoletoCode(code) {

  if (!code) return false;

  try {
    await navigator.clipboard.writeText(code);

    const button = document.getElementById('copyBoletoButton');

    if (button) {
      const oldText = button.textContent;
      button.textContent = 'Copiado!';
      setTimeout(() => {
        button.textContent = oldText;
      }, 2000);
    }

    return true;

  } catch (error) {
    console.error(
      'WashSense: erro ao copiar linha digitável:',
      error
    );

    const input = document.getElementById('boletoCodeInput');

    if (input) {
      input.focus();
      input.select();
    }

    alert(
      'Não foi possível copiar automaticamente. Selecione o código e copie manualmente.'
    );

    return false;
  }
}



async function openBoletoPayment(payment) {

  openModal(
    'Pagamento via Boleto',
    `
      <div style="text-align:center;padding:20px;">
        <div
          style="
            width:48px;
            height:48px;
            margin:0 auto 15px;
            border:4px solid #e8eef5;
            border-top-color:#0b63ce;
            border-radius:50%;
            animation:washsense-spin 1s linear infinite;
          "
        ></div>
        <p style="color:#71849a;margin:0;">
          Carregando seu boleto...
        </p>
      </div>
    `,
    null
  );

  if (confirmModalButton) {
    confirmModalButton.style.display = 'none';
  }

  try {
    const boleto = await generateBoleto(payment);

    const amount =
      boleto.amount ??
      payment.amount ??
      subscription?.amount ??
      subscription?.plan?.price_monthly ??
      0;

    const dueDate =
      boleto.dueDate || payment.due_date || null;

    const description =
      boleto.description ||
      payment.description ||
      'WashSense';

    // Compatível com a futura inclusão da linha digitável
    // pela Edge Function asaas-get-boleto.
    const identificationField =
      boleto.identificationField ||
      boleto.digitableLine ||
      boleto.line ||
      boleto.barcode ||
      '';

    if (modalTitle) {
      modalTitle.textContent = 'Pagamento via Boleto';
    }

    if (modalBody) {
      modalBody.innerHTML = `
        <div style="text-align:center;padding:5px 0 10px;">

          <div
            style="font-size:13px;color:#71849a;margin-bottom:4px;"
          >
            ${escapeHtml(description)}
          </div>

          <div
            style="font-size:26px;font-weight:700;color:#102a43;margin-bottom:6px;"
          >
            ${formatMoney(amount)}
          </div>

          <div
            style="font-size:13px;color:#71849a;margin-bottom:18px;"
          >
            Vencimento:
            <strong style="color:#536b82;">
              ${escapeHtml(formatDate(dueDate))}
            </strong>
          </div>

          ${identificationField ? `
            <div style="text-align:left;margin-top:8px;">
              <label
                style="display:block;font-size:12px;color:#71849a;margin-bottom:6px;"
              >
                Linha digitável
              </label>

              <div style="display:flex;gap:8px;align-items:stretch;">
                <input
                  id="boletoCodeInput"
                  type="text"
                  value="${escapeHtml(identificationField)}"
                  readonly
                  style="
                    flex:1;
                    min-width:0;
                    border:1px solid #dbe5ef;
                    border-radius:8px;
                    padding:11px;
                    font-size:11px;
                    color:#536b82;
                    background:#f8fafc;
                    box-sizing:border-box;
                  "
                >

                <button
                  id="copyBoletoButton"
                  type="button"
                  style="
                    border:0;
                    background:#0b315b;
                    color:#fff;
                    border-radius:8px;
                    padding:0 16px;
                    cursor:pointer;
                    font-weight:600;
                  "
                >
                  Copiar
                </button>
              </div>
            </div>
          ` : `
            <div
              style="
                margin:8px 0 16px;
                padding:11px;
                border-radius:8px;
                background:#f8fafc;
                color:#71849a;
                font-size:12px;
                text-align:left;
              "
            >
              A linha digitável será exibida aqui quando o Asaas a disponibilizar pela integração.
            </div>
          `}

          <div
            style="
              display:flex;
              flex-direction:column;
              gap:10px;
              margin-top:18px;
            "
          >
            <a
              href="${escapeHtml(boleto.bankSlipUrl)}"
              target="_blank"
              rel="noopener noreferrer"
              style="
                display:block;
                text-decoration:none;
                text-align:center;
                padding:12px 16px;
                border-radius:8px;
                background:#0b63ce;
                color:#fff;
                font-weight:600;
              "
            >
              📄 Baixar boleto PDF
            </a>

            <a
              href="${escapeHtml(boleto.bankSlipUrl)}"
              target="_blank"
              rel="noopener noreferrer"
              style="
                display:block;
                text-decoration:none;
                text-align:center;
                padding:11px 16px;
                border-radius:8px;
                border:1px solid #dbe5ef;
                background:#fff;
                color:#0b315b;
                font-weight:600;
              "
            >
              👁 Visualizar boleto
            </a>
          </div>

          <div
            style="
              margin-top:16px;
              padding:11px;
              border-radius:8px;
              background:#f1f7fd;
              color:#41617d;
              font-size:12px;
            "
          >
            Após o pagamento, o status será atualizado automaticamente.
          </div>
        </div>
      `;

      document
        .getElementById('copyBoletoButton')
        ?.addEventListener(
          'click',
          () => copyBoletoCode(identificationField)
        );

      document
        .getElementById('boletoCodeInput')
        ?.addEventListener(
          'click',
          event => event.target.select()
        );
    }

    if (confirmModalButton) {
      confirmModalButton.style.display = '';
      confirmModalButton.textContent = 'Fechar';
      confirmModalButton.onclick = closeModal;
    }

  } catch (error) {
    console.error(
      'WashSense: erro ao carregar boleto:',
      error
    );

    if (modalTitle) {
      modalTitle.textContent = 'Não foi possível carregar o boleto';
    }

    if (modalBody) {
      modalBody.innerHTML = `
        <div style="text-align:center;padding:20px;">
          <div style="font-size:42px;margin-bottom:12px;">⚠️</div>
          <h3 style="margin:0 0 10px;color:#102a43;">
            Boleto indisponível
          </h3>
          <p style="color:#71849a;margin:0;">
            ${escapeHtml(
              error?.message || 'Ocorreu um erro inesperado.'
            )}
          </p>
        </div>
      `;
    }

    if (confirmModalButton) {
      confirmModalButton.style.display = '';
      confirmModalButton.textContent = 'Fechar';
      confirmModalButton.onclick = closeModal;
    }
  }
}



// =========================================================

async function openCreditCardPayment(payment) {



  stopPixPolling();



  if (!payment?.provider_payment_id) {

    openModal(

      'Erro',

      `

        <div style="text-align:center;padding:20px;">

          <h3 style="color:#c0392b;">

            Cobrança inválida

          </h3>



          <p style="color:#71849a;">

            Não foi possível identificar a cobrança para pagamento.

          </p>

        </div>

      `,

      closeModal

    );



    return;

  }



  const amount =

    payment.amount ||

    subscription?.amount ||

    subscription?.plan?.price_monthly ||

    0;





  // =====================================================

  // FORMULÁRIO

  // =====================================================



  openModal(

    'Pagamento com cartão',

    `

      <div

        style="

          width:100%;
          max-width:520px;
          margin:0 auto;
          padding:4px 0;
          box-sizing:border-box;
          text-align:left;

        "

      >



        <div

          style="

            text-align:center;

            margin-bottom:20px;

          "

        >



          <div

            style="

              width:58px;

              height:58px;

              margin:0 auto 12px;

              border-radius:14px;

              background:#eaf4ff;

              display:flex;

              align-items:center;

              justify-content:center;

              font-size:28px;

            "

          >

            💳

          </div>



          <h3

            style="

              margin:0 0 5px;

              color:#102a43;

            "

          >

            Pagamento seguro

          </h3>



          <p

            style="

              margin:0;

              color:#71849a;

              font-size:13px;

            "

          >

            Valor da cobrança:

            <strong>

              ${formatMoney(amount)}

            </strong>

          </p>



        </div>





        <!-- NÚMERO DO CARTÃO -->



        <div style="margin-bottom:13px;">



          <label

            style="

              display:block;

              margin-bottom:6px;

              font-size:13px;

              font-weight:600;

              color:#102a43;

            "

          >

            Número do cartão

          </label>



          <input

            id="cardNumber"
            oninput="formatCardNumberField(this)"

            type="text"

            inputmode="numeric"

            autocomplete="cc-number"

            maxlength="19"

            placeholder="0000 0000 0000 0000"

            style="

              width:100%;

              box-sizing:border-box;

              padding:12px;

              border:1px solid #d8e1ea;

              border-radius:8px;

              outline:none;

              font-size:15px;

            "

          >



        </div>





        <!-- NOME -->



        <div style="margin-bottom:13px;">



          <label

            style="

              display:block;

              margin-bottom:6px;

              font-size:13px;

              font-weight:600;

              color:#102a43;

            "

          >

            Nome no cartão

          </label>



          <input

            id="cardHolder"

            type="text"

            autocomplete="cc-name"

            placeholder="Nome exatamente como no cartão"

            style="

              width:100%;

              box-sizing:border-box;

              padding:12px;

              border:1px solid #d8e1ea;

              border-radius:8px;

              outline:none;

              font-size:15px;

            "

          >



        </div>





        <!-- VALIDADE + CVV -->



        <div

          style="

            display:grid;

            grid-template-columns:1fr 1fr;

            gap:10px;

            margin-bottom:13px;

          "

        >



          <div>



            <label

              style="

                display:block;

                margin-bottom:6px;

                font-size:13px;

                font-weight:600;

                color:#102a43;

              "

            >

              Validade

            </label>



            <input

              id="cardExpiry"
              oninput="formatCardExpiryField(this)"

              type="text"

              inputmode="numeric"

              autocomplete="cc-exp"

              maxlength="5"

              placeholder="MM/AA"

              style="

                width:100%;

                box-sizing:border-box;

                padding:12px;

                border:1px solid #d8e1ea;

                border-radius:8px;

                outline:none;

                font-size:15px;

              "

            >



          </div>





          <div>



            <label

              style="

                display:block;

                margin-bottom:6px;

                font-size:13px;

                font-weight:600;

                color:#102a43;

              "

            >

              CVV

            </label>



            <input

              id="cardCvv"
              oninput="this.value=this.value.replace(/\D/g,'').slice(0,4)"

              type="password"

              inputmode="numeric"

              autocomplete="cc-csc"

              maxlength="4"

              placeholder="123"

              style="

                width:100%;

                box-sizing:border-box;

                padding:12px;

                border:1px solid #d8e1ea;

                border-radius:8px;

                outline:none;

                font-size:15px;

              "

            >



          </div>



        </div>





        <!-- CPF -->



        <div style="margin-bottom:13px;">



          <label

            style="

              display:block;

              margin-bottom:6px;

              font-size:13px;

              font-weight:600;

              color:#102a43;

            "

          >

            CPF/CNPJ do titular

          </label>



          <input

            id="holderCpf"
            oninput="this.value=formatCpfCnpj(this.value)"

            type="text"

            inputmode="numeric"

            autocomplete="off"

            maxlength="18"

            placeholder="000.000.000-00"

            style="

              width:100%;

              box-sizing:border-box;

              padding:12px;

              border:1px solid #d8e1ea;

              border-radius:8px;

              outline:none;

              font-size:15px;

            "

          >



        </div>





        <!-- CEP + NÚMERO -->



        <div

          style="

            display:grid;

            grid-template-columns:1fr 110px;

            gap:10px;

            margin-bottom:13px;

          "

        >



          <div>



            <label

              style="

                display:block;

                margin-bottom:6px;

                font-size:13px;

                font-weight:600;

                color:#102a43;

              "

            >

              CEP

            </label>



            <input

              id="cardPostalCode"
              oninput="this.value=this.value.replace(/\D/g,'').slice(0,8).replace(/(\d{5})(\d)/,'$1-$2')"

              type="text"

              inputmode="numeric"

              autocomplete="postal-code"

              maxlength="9"

              placeholder="00000-000"

              style="

                width:100%;

                box-sizing:border-box;

                padding:12px;

                border:1px solid #d8e1ea;

                border-radius:8px;

                outline:none;

                font-size:15px;

              "

            >



          </div>





          <div>



            <label

              style="

                display:block;

                margin-bottom:6px;

                font-size:13px;

                font-weight:600;

                color:#102a43;

              "

            >

              Nº

            </label>



            <input

              id="cardAddressNumber"

              type="text"

              autocomplete="off"

              placeholder="123"

              style="

                width:100%;

                box-sizing:border-box;

                padding:12px;

                border:1px solid #d8e1ea;

                border-radius:8px;

                outline:none;

                font-size:15px;

              "

            >



          </div>



        </div>





        <!-- COMPLEMENTO -->



        <div style="margin-bottom:13px;">



          <label

            style="

              display:block;

              margin-bottom:6px;

              font-size:13px;

              font-weight:600;

              color:#102a43;

            "

          >

            Complemento

            <span

              style="

                color:#71849a;

                font-weight:400;

              "

            >

              (opcional)

            </span>

          </label>



          <input

            id="cardAddressComplement"

            type="text"

            autocomplete="off"

            placeholder="Apartamento, sala..."

            style="

              width:100%;

              box-sizing:border-box;

              padding:12px;

              border:1px solid #d8e1ea;

              border-radius:8px;

              outline:none;

              font-size:15px;

            "

          >



        </div>





        <!-- TELEFONE -->



        <div style="margin-bottom:13px;">



          <label

            style="

              display:block;

              margin-bottom:6px;

              font-size:13px;

              font-weight:600;

              color:#102a43;

            "

          >

            Celular

          </label>



          <input

            id="cardMobilePhone"
            oninput="this.value=this.value.replace(/\D/g,'').slice(0,11).replace(/(\d{2})(\d)/,'($1) $2').replace(/(\d{5})(\d)/,'$1-$2')"

            type="text"

            inputmode="tel"

            autocomplete="tel"

            maxlength="15"

            placeholder="(11) 99999-9999"

            style="

              width:100%;

              box-sizing:border-box;

              padding:12px;

              border:1px solid #d8e1ea;

              border-radius:8px;

              outline:none;

              font-size:15px;

            "

          >



        </div>





        <div

          style="

            margin-top:16px;

            padding:11px;

            border-radius:8px;

            background:#f1f7fd;

            color:#41617d;

            font-size:12px;

            line-height:1.5;

          "

        >

          🔒 Seus dados do cartão são enviados somente para

          processamento do pagamento e não são armazenados pelo WashSense.

        </div>



      </div>

    `,

    async () => {



      // ===================================================

      // CAPTURA DOS CAMPOS

      // ===================================================



      const cardNumber =

        document.getElementById(

          'cardNumber'

        )?.value.trim();



      const cardHolder =

        document.getElementById(

          'cardHolder'

        )?.value.trim();



      const cardExpiry =

        document.getElementById(

          'cardExpiry'

        )?.value.trim();



      const cardCvv =

        document.getElementById(

          'cardCvv'

        )?.value.trim();



      const holderCpf =

        document.getElementById(

          'holderCpf'

        )?.value.trim();



      const postalCode =

        document.getElementById(

          'cardPostalCode'

        )?.value.trim();



      const addressNumber =

        document.getElementById(

          'cardAddressNumber'

        )?.value.trim();



      const addressComplement =

        document.getElementById(

          'cardAddressComplement'

        )?.value.trim();



      const mobilePhone =

        document.getElementById(

          'cardMobilePhone'

        )?.value.trim();





      // ===================================================

      // NORMALIZAÇÃO E VALIDAÇÃO

      const onlyDigits = value => String(value || '').replace(/\D/g, '');
      const normalizedCardNumber = onlyDigits(cardNumber);
      const normalizedCpf = onlyDigits(holderCpf);
      const normalizedPostalCode = onlyDigits(postalCode);
      const normalizedMobilePhone = onlyDigits(mobilePhone);
      const normalizedExpiry = String(cardExpiry || '').replace(/\s/g, '');

      if (!normalizedCardNumber || !cardHolder || !normalizedExpiry || !cardCvv || !normalizedCpf || !normalizedPostalCode || !addressNumber || !normalizedMobilePhone) {
        alert('Preencha todos os campos obrigatórios.');
        return;
      }

      if (normalizedCardNumber.length < 13 || normalizedCardNumber.length > 19) {
        alert('Informe um número de cartão válido.');
        return;
      }

      let luhnSum = 0;
      let shouldDouble = false;
      for (let i = normalizedCardNumber.length - 1; i >= 0; i--) {
        let digit = Number(normalizedCardNumber[i]);
        if (shouldDouble) {
          digit *= 2;
          if (digit > 9) digit -= 9;
        }
        luhnSum += digit;
        shouldDouble = !shouldDouble;
      }

      if (luhnSum % 10 !== 0) {
        alert('O número do cartão informado é inválido.');
        return;
      }

      const expiryParts = normalizedExpiry.split('/');
      if (expiryParts.length !== 2) {
        alert('Informe a validade no formato MM/AA.');
        return;
      }

      const expiryMonth = expiryParts[0];





      let expiryYear = expiryParts[1];

      if (expiryMonth.length !== 2 || expiryYear.length !== 2 || !/^\d{2}$/.test(expiryMonth) || !/^\d{2}$/.test(expiryYear)) {
        alert('Informe a validade no formato MM/AA.');
        return;
      }

      const expiryMonthNumber = Number(expiryMonth);
      if (expiryMonthNumber < 1 || expiryMonthNumber > 12) {
        alert('Informe um mês de validade entre 01 e 12.');
        return;
      }

      const expiryYearFull = `20${expiryYear}`;
      const expiryDate = new Date(Number(expiryYearFull), expiryMonthNumber, 0, 23, 59, 59);
      if (expiryDate < new Date()) {
        alert('O cartão informado está vencido.');
        return;
      }

      const normalizedCvv = onlyDigits(cardCvv);
      if (!/^[0-9]{3,4}$/.test(normalizedCvv)) {
        alert('Informe um CVV válido.');
        return;
      }

      // ===================================================

      // IP DO CLIENTE

      // ===================================================



      let remoteIp = null;



      try {



        const ipResponse =

          await fetch(

            'https://api.ipify.org?format=json'

          );



        if (ipResponse.ok) {



          const ipData =

            await ipResponse.json();



          remoteIp =

            ipData?.ip || null;



        }



      } catch (error) {



        console.warn(

          'WashSense: não foi possível obter o IP público.',

          error

        );



      }





      // ===================================================

      // MOSTRA PROCESSAMENTO

      // ===================================================



      openModal(

        'Processando pagamento',

        `

          <div

            style="

              text-align:center;

              padding:30px 20px;

            "

          >



            <div

              style="

                width:44px;

                height:44px;

                border:4px solid #dce6f0;

                border-top-color:#1687f8;

                border-radius:50%;

                animation:washsense-spin 1s linear infinite;

                margin:0 auto 18px;

              "

            ></div>



            <h3

              style="

                margin:0 0 8px;

                color:#102a43;

              "

            >

              Processando pagamento

            </h3>



            <p

              style="

                margin:0;

                color:#71849a;

              "

            >

              Estamos aguardando a autorização da operadora.

            </p>



          </div>

        `,

        null

      );





      if (confirmModalButton) {



        confirmModalButton.style.display =

          'none';



      }





      try {



        // ===============================================

        // SESSÃO

        // ===============================================



        const {

          data: {

            session

          }

        } =

          await supabaseClient.auth.getSession();





        if (!session) {



          throw new Error(

            'Sua sessão expirou. Faça login novamente.'

          );



        }





        // ===============================================

        // CHAMADA EDGE FUNCTION

        // ===============================================



        const response =

          await fetch(

            `${SUPABASE_URL}/functions/v1/asaas-pay-credit-card`,

            {

              method: 'POST',



              headers: {



                'Authorization':

                  `Bearer ${session.access_token}`,



                'apikey':

                  SUPABASE_ANON_KEY,



                'Content-Type':

                  'application/json'

              },



              body:

                JSON.stringify({



                  paymentId:

                    payment.provider_payment_id,



                  organization_id:

                    organizationId,



                  cardNumber: normalizedCardNumber,

                  cardHolder: cardHolder.trim(),



                  cardExpiryMonth:

                    expiryMonth,



                  cardExpiryYear:
                    expiryYearFull,



                  cardCcv: normalizedCvv,

                  holderCpf: normalizedCpf,

                  postalCode: normalizedPostalCode,

                  addressNumber: addressNumber.trim(),

                  addressComplement: addressComplement.trim(),

                  mobilePhone: normalizedMobilePhone,



                  remoteIp



                })

            }

          );





        const result =

          await response.json();





        console.log(

          'WashSense: resposta do pagamento por cartão:',

          {

            success:

              result?.success,



            status:

              result?.status,



            paymentId:

              result?.paymentId,



            error:

              result?.error

          }

        );





        // ===============================================

        // ERRO

        // ===============================================



        if (

          !response.ok ||

          !result?.success

        ) {



          throw new Error(

            result?.error ||

            'Não foi possível processar o pagamento.'

          );



        }





        // ===============================================

        // PAGAMENTO APROVADO

        // Configura o mesmo cartão para as próximas cobranças
        let recurringCardUpdated = false;

        try {

          const recurringResponse = await fetch(
            `${SUPABASE_URL}/functions/v1/asaas-set-recurring-card`,
            {
              method: 'POST',

              headers: {
                'Authorization':
                  `Bearer ${session.access_token}`,

                'apikey':
                  SUPABASE_ANON_KEY,

                'Content-Type':
                  'application/json'
              },

              body: JSON.stringify({

                cardNumber: normalizedCardNumber,

                  cardHolder: cardHolder.trim(),

                cardExpiryMonth:
                  expiryMonth,

                cardExpiryYear:
                    expiryYearFull,

                cardCcv: normalizedCvv,

                  holderCpf: normalizedCpf,

                  postalCode: normalizedPostalCode,

                  addressNumber: addressNumber.trim(),

                  addressComplement: addressComplement.trim(),

                  mobilePhone: normalizedMobilePhone,

                remoteIp

              })
            }
          );

          const recurringResult =
            await recurringResponse.json();

          console.log(
            'WashSense: configuração do cartão recorrente:',
            {
              success:
                recurringResult?.success,

              subscriptionId:
                recurringResult?.subscriptionId,

              paymentMethod:
                recurringResult?.paymentMethod,

              cardBrand:
                recurringResult?.cardBrand,

              cardLast4:
                recurringResult?.cardLast4,

              error:
                recurringResult?.error
            }
          );

          if (
            recurringResponse.ok &&
            recurringResult?.success
          ) {

            recurringCardUpdated = true;

          } else {

            console.warn(
              'WashSense: pagamento aprovado, mas não foi possível configurar o cartão recorrente.',
              recurringResult?.error
            );

          }

        } catch (recurringError) {

          console.warn(
            'WashSense: erro ao configurar cartão recorrente.',
            recurringError
          );

        }

        await reloadFinancialData();





        if (modalTitle) {



          modalTitle.textContent =

            'Pagamento aprovado';



        }





        if (modalBody) {



          modalBody.innerHTML = `

            <div

              style="

                text-align:center;

                padding:20px 5px;

              "

            >



              <div

                style="

                  width:72px;

                  height:72px;

                  margin:0 auto 18px;

                  border-radius:50%;

                  display:flex;

                  align-items:center;

                  justify-content:center;

                  background:#e8f8ef;

                  color:#1e9b5a;

                  font-size:38px;

                  font-weight:700;

                "

              >

                ✓

              </div>





              <h3

                style="

                  margin:0 0 10px;

                  color:#102a43;

                  font-size:22px;

                "

              >

                Pagamento aprovado!

              </h3>





              <p

                style="

                  margin:0 0 8px;

                  color:#71849a;

                "

              >

                O pagamento de

                <strong>

                  ${formatMoney(amount)}

                </strong>

                foi processado com sucesso.

              </p>





              ${

                result.creditCard?.brand

                  ? `

                    <p

                      style="

                        margin:10px 0 0;

                        color:#71849a;

                        font-size:13px;

                      "

                    >

                      Cartão:

                      <strong>

                        ${escapeHtml(

                          result.creditCard.brand

                        )}

                      </strong>

                      ${

                        result.creditCard.last4

                          ? `•••• ${escapeHtml(

                              result.creditCard.last4

                            )}`

                          : ''

                      }

                    </p>

                  `

                  : ''

              }





              <p

                style="

                  margin:14px 0 0;

                  color:#71849a;

                  font-size:12px;

                "

              >

                ${
                  recurringCardUpdated
                    ? 'Seu cartão foi salvo para as próximas cobranças recorrentes.'
                    : 'O pagamento foi aprovado, mas o cartão recorrente ainda não foi configurado.'
                }

              </p>



            </div>

          `;



        }





        if (confirmModalButton) {



          confirmModalButton.style.display =

            '';



          confirmModalButton.textContent =

            'Fechar';



          confirmModalButton.onclick =

            closeModal;



        }





      } catch (error) {



        console.error(

          'WashSense: erro no pagamento com cartão:',

          error

        );





        if (modalTitle) {



          modalTitle.textContent =

            'Pagamento não aprovado';



        }





        if (modalBody) {



          modalBody.innerHTML = `

            <div

              style="

                text-align:center;

                padding:20px;

              "

            >



              <div

                style="

                  font-size:42px;

                  margin-bottom:12px;

                "

              >

                ⚠️

              </div>





              <h3

                style="

                  margin:0 0 10px;

                  color:#102a43;

                "

              >

                Não foi possível processar

              </h3>





              <p

                style="

                  margin:0;

                  color:#71849a;

                  line-height:1.5;

                "

              >

                ${escapeHtml(

                  error?.message ||

                  'O pagamento foi recusado ou ocorreu um erro.'

                )}

              </p>



            </div>

          `;



        }





        if (confirmModalButton) {



          confirmModalButton.style.display =

            '';



          confirmModalButton.textContent =

            'Fechar';



          confirmModalButton.onclick =

            closeModal;



        }



      }



    }

  );
}

window.openCreditCardPayment = openCreditCardPayment;


// PAGAR AGORA

// =========================================================



payNowButton?.addEventListener(

  'click',

  () => {



    const payment =

      getPendingPayment();



    if (!payment) {

      openModal(

        'Pagamento',

        `

          <div

            style="

              text-align:center;

              padding:20px;

            "

          >

            <h3>

              Nenhuma cobrança pendente

            </h3>



            <p

              style="

                color:#71849a;

              "

            >

              Não encontramos uma cobrança em aberto para sua assinatura.

            </p>

          </div>

        `,

        closeModal

      );



      if (confirmModalButton) {

        confirmModalButton.textContent =

          'Fechar';

      }



      return;

    }



    const amount =

      payment.amount ||

      subscription?.amount ||

      subscription?.plan?.price_monthly ||

      0;



    openModal(

      'Pagar mensalidade',

      `

        <div class="choice-list">



          <label class="choice">



            <input

              type="radio"

              name="pay"

              value="pix"

              checked

            >



            <strong>

              PIX

            </strong>



            <span>

              Pague diretamente nesta página usando QR Code ou código copia e cola.

            </span>



          </label>



          <label class="choice">



            <input

              type="radio"

              name="pay"

              value="boleto"

            >



            <strong>

              Boleto

            </strong>



            <span>

              Boleto bancário com PDF e opções de pagamento dentro do WashSense.

            </span>



          </label>


          <label class="choice">

            <input

              type="radio"

              name="pay"

              value="credit_card"

            >

            <strong>

              Cartão de crédito

            </strong>

            <span>

              Pague com cartão de crédito diretamente no WashSense.

            </span>

          </label>



        </div>



        <p

          style="

            margin-top:18px;

            color:#71849a;

            font-size:13px;

          "

        >

          Valor da cobrança:

          <strong>

            ${formatMoney(amount)}

          </strong>

        </p>

      `,

      async () => {



        const selected =

          document.querySelector(

            'input[name="pay"]:checked'

          )?.value;



        if (selected === 'boleto') {

          await openBoletoPayment(
            payment
          );

          return;
        }

        
        if (selected === 'credit_card') {

          await openCreditCardPayment(
            payment
          );

          return;
        }

        await openPixPayment(
          payment
        );

      }

    );



    if (confirmModalButton) {

      confirmModalButton.textContent =

        'Continuar';

    }

  }

);





// =========================================================

// ALTERAR PLANO

// =========================================================



changePlanButton?.addEventListener(

  'click',

  () => {



    plansSection?.scrollIntoView({

      behavior: 'smooth'

    });



  }

);





document

  .querySelectorAll('[data-plan]')

  .forEach(button => {



    button.addEventListener(

      'click',

      () => {



        const selectedPlan =

          button.dataset.plan;



        openModal(

          'Alterar plano',



          `

            <div class="choice-list">



              <label class="choice">



                <input

                  type="radio"

                  checked

                >



                <strong>

                  ${escapeHtml(

                    selectedPlan

                  )}

                </strong>



                <span>

                  Solicitação de alteração de plano.

                </span>



              </label>



            </div>

          `,



          () => {

            alert(

              `Solicitação de alteração para o plano ${selectedPlan} registrada.`

            );



            closeModal();

          }

        );



        if (confirmModalButton) {

          confirmModalButton.textContent =

            'Continuar';

        }

      }

    );



  });





// =========================================================

// ALTERAR FORMA DE PAGAMENTO

// =========================================================



changeMethodButton?.addEventListener(

  'click',

  () => {



    openModal(

      'Forma de pagamento',



      `

        <div class="choice-list">



          <label class="choice">



            <input

              type="radio"

              name="method"

              checked

            >



            <strong>

              PIX

            </strong>



            <span>

              QR Code e código copia e cola.

            </span>



          </label>



          <label class="choice">



            <input

              type="radio"

              name="method"

            >



            <strong>

              Boleto bancário

            </strong>



            <span>

              Emissão de boleto bancário.

            </span>



          </label>



          <label class="choice">



            <input

              type="radio"

              name="method"

            >



            <strong>

              Cartão de crédito

            </strong>



            <span>

              Conforme configuração da assinatura.

            </span>



          </label>



        </div>

      `,



      () => {



        alert(

          'Forma de pagamento atualizada.'

        );



        closeModal();



      }

    );



    if (confirmModalButton) {

      confirmModalButton.textContent =

        'Salvar';

    }

  }

);





// =========================================================

// FILTRO

// =========================================================



historyFilter?.addEventListener(

  'change',

  renderPayments

);





// =========================================================

// MENU MOBILE

// =========================================================



document

  .getElementById('menuBtn')

  ?.addEventListener(

    'click',

    () => {



      document

        .getElementById('sidebar')

        ?.classList.toggle(

          'open'

        );



    }

  );





// =========================================================

// INICIALIZAÇÃO

// =========================================================



async function initFinance() {



  console.log(

    'WashSense Financeiro iniciado.'

  );



  setLoadingState();



  try {



    // -----------------------------------------------------

    // 1. VERIFICAR SESSÃO

    // -----------------------------------------------------



    const {

      data: {

        session

      }

    } =

      await supabaseClient.auth.getSession();



    console.log(

      'Sessão Supabase:',

      session

        ? 'AUTENTICADO'

        : 'NÃO AUTENTICADO'

    );



    if (!session) {

      throw new Error(

        'Usuário não autenticado.'

      );

    }





    // -----------------------------------------------------

    // 2. ORGANIZAÇÃO

    // -----------------------------------------------------



    await loadOrganization();





    // -----------------------------------------------------

    // 3. ASSINATURA

    // -----------------------------------------------------



    await loadSubscription();





    // -----------------------------------------------------

    // 4. PAGAMENTOS

    // -----------------------------------------------------



    await loadPayments();





    // -----------------------------------------------------

    // 5. RENDERIZAR

    // -----------------------------------------------------



    renderSubscription();



    console.log(

      'WashSense Financeiro carregado com sucesso.'

    );



  }



  catch(error) {



    console.error(

      'WashSense Financeiro:',

      error

    );



    if (paymentRows) {



      paymentRows.innerHTML = `

        <tr>



          <td

            colspan="6"

            style="

              text-align:center;

              padding:30px;

              color:#c0392b;

            "

          >

            Não foi possível carregar

            os dados financeiros.

          </td>



        </tr>

      `;



    }



  }



}





// =========================================================

// INICIAR

// =========================================================



initFinance();





// =========================================================

// CSS AUXILIAR DO SPINNER

// =========================================================



if (!document.getElementById('washsensePixStyles')) {



  const style =

    document.createElement('style');



  style.id =

    'washsensePixStyles';



  style.textContent = `

    @keyframes washsense-spin {

      from {

        transform: rotate(0deg);

      }



      to {

        transform: rotate(360deg);

      }

    }

  `;



  document.head.appendChild(style);

}
}
