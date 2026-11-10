// Mensagens rápidas (sem alert do navegador). O contêiner é criado na primeira mensagem.
const colors = {
    success: 'border-emerald-500/50 bg-slate-900 text-emerald-300',
    info: 'border-indigo-500/50 bg-slate-900 text-indigo-300',
    warning: 'border-amber-500/50 bg-slate-900 text-amber-300',
    critical: 'border-red-500/60 bg-red-950 text-red-200'
};
const icons = {
    success: 'fa-circle-check text-emerald-400',
    info: 'fa-circle-info text-indigo-400',
    warning: 'fa-triangle-exclamation text-amber-400',
    critical: 'fa-bell text-red-400'
};

function getContainer() {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.setAttribute('role', 'status');
        container.setAttribute('aria-live', 'polite');
        container.className = 'fixed bottom-5 right-5 z-50 space-y-2 max-w-sm w-full pointer-events-none';
        document.body.appendChild(container);
    }
    return container;
}

export function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `pointer-events-auto p-3.5 rounded-xl border shadow-2xl flex items-start gap-2.5 text-xs font-medium transition-all duration-300 ${colors[type] || colors.info}`;
    const icon = document.createElement('i');
    icon.className = `fa-solid ${icons[type] || icons.info} mt-0.5 text-sm`;
    icon.setAttribute('aria-hidden', 'true');
    const text = document.createElement('div');
    text.className = 'flex-1 leading-relaxed';
    text.textContent = message; // mensagens podem conter dados do usuário (ex.: nome da zona): nunca HTML
    toast.append(icon, text);
    getContainer().appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4200);
}
