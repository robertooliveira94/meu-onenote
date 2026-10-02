---
type: "query"
date: "2026-09-29T00:52:36.761565+00:00"
question: "Quero que primeiro você entenda todo o projeto, leia o repositório todo"
contributor: "graphify"
outcome: "useful"
source_nodes: ["resolverCaminho()", "atualizarIndice()", "PaginaNota()", "QuadroKanban()"]
---

# Q: Quero que primeiro você entenda todo o projeto, leia o repositório todo

## Answer

Expanded from original query via vocab: [notas, kanban, senhas, links, saude, compras, extensao, arquivos, acoes, produto, quadro, cofre]. O projeto é uma aplicação pessoal local-first em Next.js 15 e React 19. O disco é a fonte de verdade: notas e Kanban usam arquivos, enquanto links, compras e saúde usam estruturas JSON; o cofre usa KDBX com Argon2. A arquitetura separa rotas e Server Actions em src/app, componentes de interface em src/components e domínio/persistência em src/lib. Os principais pontos de convergência são resolverCaminho(), atualizarIndice(), PaginaNota() e QuadroKanban(). Há também uma extensão de navegador integrada aos endpoints locais para senhas, links e produtos.

## Outcome

- Signal: useful

## Source Nodes

- resolverCaminho()
- atualizarIndice()
- PaginaNota()
- QuadroKanban()