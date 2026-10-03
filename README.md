# Colmeia Digital — Backend API

Serviço de backend em Node.js (Express + TypeScript) para o sistema **Colmeia Digital**, projetado para gestão inteligente e monitoramento operacional de unidades apícolas, colmeias, inspeções técnicas e manejos de campo.

## 🚀 Tecnologias

- **Runtime:** Node.js (ES Modules)
- **Framework:** Express.js 4
- **Linguagem:** TypeScript
- **Banco de Dados:** SQLite (`colmeia_digital.db`) para desenvolvimento local e PostgreSQL/Supabase em produção.

## 📦 Módulos Principais

1. **Apiários (Unidades Apícolas):** Cadastro, monitoramento, geo-localização e compartilhamento entre apicultores.
2. **Colmeias:** Gestão e posicionamento das caixas dentro de cada apiário.
3. **Inspeções / Revisões:** Registro detalhado dos parâmetros biológicos da colmeia (rainha, postura, crias, mel, pólen, sanidade).
4. **Manejos:** Registro técnico de intervenções (alimentação, divisão, cera, melgueiras, defesa).
5. **Painel Analítico & Relatórios:** Consolidação métrica com gráficos temporais em tela.

## 🛠️ Como Executar

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env

# Executar em modo desenvolvimento
npm run dev

# Compilar para produção
npm run build
npm start
```
