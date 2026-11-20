### 1. Principles

- **Code is the game's memory.** Every Claude call starts empty. Each turn, code builds every agent's view from the save.
- **Unsaved means forgotten.** Anything Claude says that code doesn't save is lost. What must stay true is saved as data; Claude may re-describe it freely.
- **Saving costs no tokens.** Only what a view sends costs tokens. A crippled wing on an absent dragon costs nothing; on a present one, one line.
- **No model writes the save.** Agents return requests and proposals. The validator and engine decide; only the engine writes (section 8).
- **Numbers become words at the view.** Views send states ("Crippled"), never pools, HP or Burden.
