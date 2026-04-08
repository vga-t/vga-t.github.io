---
trigger: always_on
---

# General rules

## 1. New features must be created in new files
Never implement new logic inside `main.ts`.  
Each feature = its own file for clarity, modularity, and optimization.

---

## 2. `main.ts` is only an overview
`main.ts` should only:
- import modules  
- initialize the app  
- show the high‑level flow  

No detailed logic belongs here.

---

## 3. TypeScript usage must include JS parallels
Whenever using TS‑specific features, briefly explain how it relates to JavaScript.

Example:
```ts
interface Config { size: number }
// JS parallel: this is like defining an object shape by convention.
```

---

## 4. Follow clean engineering practices
- One responsibility per file  
- No mixing concerns  
- Prefer composition  
- Avoid unnecessary global state  

---

## 5. Optimization is required
- Avoid unnecessary allocations  
- Keep per‑frame or repeated work minimal  
- Use efficient data structures  
- Document any performance‑heavy code  

---

## 6. Keep structure consistent
Example:
```
/src
  /modules
  /utils
  main.ts
```