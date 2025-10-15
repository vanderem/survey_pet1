const form = document.getElementById('formulario');
const preview = document.getElementById('preview');
const fields = Array.from(form.querySelectorAll('.field.question'));
const totalSteps = fields.length;
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const submitBtn = document.getElementById('submitBtn');

let currentStep = 0;

function updateProgress() {
    const percent = ((currentStep + 1) / totalSteps) * 100;
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `Pergunta ${currentStep + 1} de ${totalSteps}`;
}

function showStep(index) {
    fields.forEach((field, i) => {
        if (i === index) field.classList.remove('hidden');
        else field.classList.add('hidden');
    });

    prevBtn.style.display = index === 0 ? 'none' : 'inline-flex';
    nextBtn.style.display = index === totalSteps - 1 ? 'none' : 'inline-flex';
    submitBtn.style.display = index === totalSteps - 1 ? 'inline-flex' : 'none';

    updateProgress();
}

function validateStep(index, report = true) {
    const field = fields[index];
    if (!field) return true;
    let valid = true;

    // grupos de radios/checkboxes
    const groups = {};
    field.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(input => {
        if (!groups[input.name]) groups[input.name] = { inputs: [], required: false };
        groups[input.name].inputs.push(input);
        if (input.required) groups[input.name].required = true;
        input.setCustomValidity('');
    });

    for (const name in groups) {
        const group = groups[name];
        if (!group.required) continue;
        const checked = group.inputs.some(input => input.checked);
        if (!checked) {
            valid = false;
            if (report) {
                group.inputs[0].setCustomValidity('Selecione uma opção.');
                group.inputs[0].reportValidity();
            }
            break;
        }
    }
    if (!valid) return false;

    // outros controles
    const controls = field.querySelectorAll('input:not([type="radio"]):not([type="checkbox"]), select, textarea');
    for (const control of controls) {
        control.setCustomValidity('');
        if (control.required && control.value.trim() === '') {
            if (report) {
                control.setCustomValidity('Preencha este campo.');
                control.reportValidity();
            }
            valid = false;
            break;
        }
        if (valid && !control.checkValidity()) {
            if (report) control.reportValidity();
            valid = false;
            break;
        }
    }
    return valid;
}

function goToStep(newIndex) {
    if (newIndex < 0 || newIndex >= totalSteps) return;
    currentStep = newIndex;
    showStep(currentStep);
}

nextBtn.addEventListener('click', () => {
    if (!validateStep(currentStep, true)) return;
    goToStep(currentStep + 1);
});
prevBtn.addEventListener('click', () => goToStep(currentStep - 1));

function toggleOutro(name, inputId) {
    const checkedOutro = Array.from(document.querySelectorAll(`[name="${name}"]`))
        .some(el => el.checked && el.value === 'Outro');
    const input = document.getElementById(inputId);
    if (!input) return;
    input.style.display = checkedOutro ? 'block' : 'none';
    if (!checkedOutro) { input.value = ''; input.setCustomValidity(''); }
}

// Ranking (drag-and-drop) — atualiza inputs hidden com posições 1..N
(function initRankList(){
    const list = document.getElementById('rankList');
    if (!list) return;

    const updateRanks = () => {
        Array.from(list.children).forEach((item, idx) => {
            const pos = idx + 1;
            const badge = item.querySelector('.rank-pos');
            const input = item.querySelector('input[type="hidden"]');
            if (badge) badge.textContent = String(pos);
            if (input) input.value = String(pos);
        });
    };

    const getDragAfterElement = (container, y) => {
        const els = [...container.querySelectorAll('.rank-item:not(.dragging)')];
        return els.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) return { offset, element: child };
            return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    };

    list.addEventListener('dragstart', (e) => {
        const target = e.target.closest('.rank-item');
        if (!target) return;
        target.classList.add('dragging');
    });

    list.addEventListener('dragend', (e) => {
        const target = e.target.closest('.rank-item');
        if (target) target.classList.remove('dragging');
        updateRanks();
    });

    list.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(list, e.clientY);
        const dragging = list.querySelector('.dragging');
        if (!dragging) return;
        if (afterElement == null) list.appendChild(dragging);
        else list.insertBefore(dragging, afterElement);
    });

    updateRanks();
})();

// listeners “Outro”
;['gestao_cuidado', 'usa_app_geral', 'valor_assinatura'].forEach(n => {
    document.querySelectorAll(`[name="${n}"]`)
        .forEach(el => el.addEventListener('change', () => toggleOutro(n, `${n}_outro`)));
});

// espécie “Outro”
const especieOutroInput = document.getElementById('especie_outro');
document.querySelectorAll('[name="especie"]').forEach(el => el.addEventListener('change', () => {
    const marcouOutro = Array.from(document.querySelectorAll('[name="especie"]'))
        .some(x => x.checked && x.value === 'Outro');
    especieOutroInput.style.display = marcouOutro ? 'block' : 'none';
    if (!marcouOutro) especieOutroInput.value = '';
}));

// submit -> envia para Google Sheets (via sheets.js)
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateStep(currentStep, true)) return;

    try {
        // Usa o mapeamento centralizado do sheets.js
        const payload = typeof mapFormToPayload === 'function' ? mapFormToPayload(form) : null;
        if (!payload) throw new Error('mapFormToPayload não disponível. Verifique se sheets.js foi carregado.');

        const result = await (typeof sendToSheets === 'function' ? sendToSheets(payload) : Promise.reject('sendToSheets não disponível'));
        console.log('[Sheets] Envio concluído:', result);
        alert('Obrigado! Suas respostas foram registradas com sucesso.');

        // Após envio, recarrega página em branco
        // Em vez de resetar o formulário e voltar ao início:
        window.location.href = 'about:blank';
    } catch (err) {
        console.error('[Sheets] Falha no envio:', err);
        alert('Ocorreu um erro ao enviar suas respostas. Tente novamente.');
    }
});

// reset
form.addEventListener('reset', () => {
    setTimeout(() => {
        currentStep = 0;
        fields.forEach(field => field.classList.add('hidden'));
        fields[0].classList.remove('hidden');
        ['especie_outro','gestao_cuidado_outro','usa_app_geral_outro','valor_assinatura_outro'].forEach(id => {
            const input = document.getElementById(id);
            if (input) { input.style.display = 'none'; input.value = ''; }
        });
        preview.textContent = '{}';
        showStep(0);
    }, 0);
});

// inicial
showStep(0);