Hello-EQ 🧠💙

An Emotional Intelligence & Product Taste gym for your career.

Live app → hello-eq.club

What is Hello-EQ?
Hello-EQ is a private AI-powered journaling companion designed for your work life — built specifically for the emotional realities of careers in the AI era.
Most career tools track what you do. Hello-EQ helps you understand how you feel — and what to do about it.
Write about a difficult meeting, a rejection you're still carrying, feedback that landed hard, or a win you haven't fully processed. Hello-EQ unpacks the emotional layer behind the experience, surfaces patterns, and helps you build real self-awareness over time.
It also includes Product Taste Exercises — a shareable feature designed to help Product Managers actively hone and demonstrate their product intuition.

Why it exists
During a period of active job searching, the gap became obvious: interviewers aren't just evaluating your skills — they're evaluating your emotional intelligence. How you handle uncertainty, process feedback, and show up under pressure.
Yet most of us navigate those moments alone, without a space to reflect or grow.
Hello-EQ was built to fill that gap.

Features
🪞 AI Journal

- Write freely about your work experiences
- AI detects your dominant emotion and career context (feedback, conflict, achievement, job search, deadlines)
- Surfaces the triggers behind your reaction
- Reflects back an empathetic summary of your entry
- Tracks patterns over time and generates action recommendations to improve your EQ

🎯 Product Taste Exercises

- Structured exercises to actively build your product intuition
- Shareable results directly to LinkedIn — make your taste visible to the people hiring and building with you

🔒 Privacy First

- Private by design — no performance reviews, no leaderboards, no sharing unless you choose it
- Your journal is yours


Built with

Claude Code — AI-assisted development
Anthropic Claude API — powering the emotional intelligence layer under the hood


Who it's for

- Product Managers sharpening their craft and EQ
- Job seekers navigating the emotional rollercoaster of interviews and rejection
- Anyone in tech who wants to build self-awareness as a career skill


Potential Improvements Roadmap

 > Community growth features with APM Club
 > EQ pattern dashboard and longitudinal insights
 > More Product Taste exercise formats
 > Mobile experience improvements


Status
<> This is a v0 hobby project built with genuine belief that emotional intelligence is the defining career skill of the AI era. It is actively maintained and improved based on community feedback.
<> Feedback, ideas, and constructive criticism are very welcome — open an issue or reach out directly.

Author
Arunima Sharma
PM at Protegrity · Founder of Hello-EQ
LinkedIn https://www.linkedin.com/in/arunimasharma/ · hello-eq.club

Careers are not just built with skills. They're shaped by how well we understand ourselves along the way.

...Exit Product-focused Readme/...


--------------- OLDER README WITH LOCAL TECH SETUP EXPLANATIONS ------------------

# HELLO-EQ (previously, hei-c) is your Emotionally Intelligent Career Operating System aka an emotional intelligence & product taste gym for your career
... with private AI journaling and shareable insights built for the AI era of work.


Here's some help with the minimal setup to get React working in Vite with HMR and some ESLint rules.
Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
