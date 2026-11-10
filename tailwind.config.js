// Geração de static/css/tailwind.css (npm run build:css). Tema igual ao usado com o CDN do Tailwind 3.4.17.
// As classes em JavaScript são strings inteiras (ex.: 'bg-red-500/20'), então a varredura abaixo as encontra.
// Não monte nomes de classe por concatenação (ex.: `bg-${cor}-500`): eles não entrariam no CSS gerado.
module.exports = {
    content: ['./*.html', './static/js/**/*.js'],
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            colors: {
                risk: {
                    critical: '#DC2626',
                    high: '#EA580C',
                    moderate: '#D97706',
                    low: '#2563EB'
                }
            }
        }
    }
};
