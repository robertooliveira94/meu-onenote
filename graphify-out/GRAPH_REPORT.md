# Graph Report - meu-onenote  (2026-09-30)

## Corpus Check
- 195 files · ~170,721 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: (none) 4, .css 2, .example 1)

## Summary
- 2162 nodes · 6313 edges · 110 communities (104 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 47 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6b376623`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- senhas.ts
- acoes-saude.ts
- saude-app.ts
- atualizarIndice
- CartaoTarefa
- tipos.ts
- links-app.ts
- ui.tsx
- paleta-comandos.tsx
- QuadroKanban
- kanban.ts
- links.tsx
- atualizarTudo
- cofre-senhas.tsx
- ArvoreNotas
- acoes-links.ts
- (app)/lixeira/page.tsx
- hoje/page.tsx
- quadros.ts
- next
- arvore-notas.tsx
- acoes-senhas.ts
- rotas.ts
- saude.tsx
- manifest.json
- acoes-kanban.ts
- salvar-link/page.tsx
- urlDaNota
- arquivos.ts
- barra-formatacao.tsx
- compras.tsx
- exportar.ts
- acoes.ts
- compras-app.ts
- busca-semantica.ts
- sugestoes-editor.ts
- visualizador-markdown.tsx
- lista-quadros.tsx
- acoes-compras.ts
- avisos-prazo.tsx
- forca-senha.ts
- nota.tsx
- PaginaNota
- SalvarProdutoPopup
- entradaDaNota
- compilerOptions
- historico.ts
- popup.js
- package.json
- atalhos.tsx
- normalizarUrl
- arrastar.ts
- acaoStatusCofre
- popup-links.tsx
- dependencies
- painel-historico.tsx
- senhas-comum.tsx
- Popup da Extensão
- etiquetas.ts
- DialogoSaude
- Armazenamento de Notas em Arquivos
- salvar-produto/page.tsx
- PainelLixeira
- totp.ts
- ColunaLinks
- importar-favoritos.ts
- acaoCriarEtiquetaKanban
- acaoDefinirEtiquetasDaTarefa
- DialogoNome
- Design System: Meu bloco de anotações
- content.js
- devDependencies
- Meu bloco de anotações
- Project Knowledge Graph
- Hub de Aplicações Independentes
- acaoCriarPagina
- eslint.config.mjs
- Q: Quero que primeiro você entenda todo o projeto, leia o repositório todo
- rehype-callouts.ts
- app/layout.tsx
- LocalizarNota
- editor-teclado.ts
- scripts
- atalho-links.tsx
- Símbolo de documento branco
- fundo-editor.ts
- Serviço Docker meu-onenote
- Endereço Base do Aplicativo
- Símbolo de documento branco
- exportarHistorico
- White Document Symbol
- acaoDefinirDestinoLink
- sumario.ts
- Product Specification
- [evento]/[arquivo]/route.ts
- useZoomTexto
- Ícone do aplicativo
- 16-Pixel Icon Asset
- Ícone do aplicativo
- 48-Pixel Icon Asset
- opcoes.js
- sidepanel.js
- SumarioNota
- background.js
- InicioLinks
- postcss.config.mjs

## God Nodes (most connected - your core abstractions)
1. `QuadroKanban()` - 71 edges
2. `next` - 69 edges
3. `resolverCaminho()` - 63 edges
4. `react` - 62 edges
5. `PaginaNota()` - 59 edges
6. `atualizarIndice()` - 59 edges
7. `lucide-react` - 56 edges
8. `juntar()` - 47 edges
9. `tentar()` - 39 edges
10. `ArvoreNotas()` - 39 edges

## Surprising Connections (you probably didn't know these)
- `Árvore de Grupos e Pastas` --semantically_similar_to--> `Gerenciador de Links`  [INFERRED] [semantically similar]
  DESIGN.md → PRODUCT.md
- `Árvore de Grupos e Pastas` --semantically_similar_to--> `Cofre de Senhas KeePass`  [INFERRED] [semantically similar]
  DESIGN.md → PRODUCT.md
- `Página /links-popup` --conceptually_related_to--> `Gerenciador de Links`  [INFERRED]
  extensao/README.md → PRODUCT.md
- `Captura e Autopreenchimento de Senhas` --conceptually_related_to--> `Cofre de Senhas KeePass`  [INFERRED]
  extensao/README.md → PRODUCT.md
- `Página /salvar-produto` --conceptually_related_to--> `Lista de Compras`  [INFERRED]
  extensao/README.md → PRODUCT.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Superfícies do App Embutidas na Extensão** — extensao_readme_links_popup, extensao_readme_salvar_produto, extensao_popup_links_iframe, extensao_popup_compras_iframe, extensao_sidepanel_links_iframe [EXTRACTED 1.00]
- **Aplicações do Hub** — product_anotacoes, product_kanban, product_senhas, product_links, product_compras, product_saude [EXTRACTED 1.00]
- **Persistência Local das Anotações** — readme_armazenamento_em_arquivos, readme_indice_reconstruivel, readme_sem_banco_de_dados, readme_backup_onedrive [EXTRACTED 1.00]

## Communities (110 total, 6 thin omitted)

### Community 0 - "senhas.ts"
Cohesion: 0.05
Nodes (84): GET(), comCors(), ESQUEMAS_DE_EXTENSAO, OPTIONS(), origemDeExtensao(), recusarOrigemEstranha(), POST(), GET() (+76 more)

### Community 1 - "acoes-saude.ts"
Cohesion: 0.10
Nodes (36): acaoAtualizarEspecialidade(), acaoAtualizarEvento(), acaoAtualizarLocal(), acaoAtualizarPessoa(), acaoAtualizarProfissional(), acaoCriarEspecialidade(), acaoCriarEvento(), acaoCriarLocal() (+28 more)

### Community 2 - "saude-app.ts"
Cohesion: 0.07
Nodes (62): POST(), dynamic, PaginaSaude(), adicionarAnexo(), alterar(), apagarAnexosDoEvento(), apagarDeVezDaLixeira(), ARQUIVO_DADOS (+54 more)

### Community 3 - "atualizarIndice"
Cohesion: 0.14
Nodes (35): converterFormato(), criarNota(), criarPasta(), escreverNota(), existe(), moverItem(), nomeDisponivel(), regravarDesenho() (+27 more)

### Community 4 - "CartaoTarefa"
Cohesion: 0.22
Nodes (11): acaoDefinirDatasDaSprint(), acaoFecharSprint(), CartaoTarefa(), DialogoSprints(), fechar(), mudarData(), formatarPrazo(), iniciarArrastoDeTarefa() (+3 more)

### Community 5 - "tipos.ts"
Cohesion: 0.06
Nodes (51): CampoNovaTarefa(), CORES_COLUNA, DialogoTarefa(), LinhaSubtarefa(), PainelTarefa(), PropsConteudoTarefa, Sobrevoo, RotuloMenu() (+43 more)

### Community 6 - "links-app.ts"
Cohesion: 0.06
Nodes (74): dynamic, TelaLixeiraLinks(), buscarDadosDoProduto(), acharDuplicado(), buscar(), achatar(), alterar(), ARQUIVO_ARVORE (+66 more)

### Community 7 - "ui.tsx"
Cohesion: 0.12
Nodes (26): clsx, lucide-react, react, DialogoConfirmar(), BotaoComoFunciona(), COR_FORCA, Modo, Estado (+18 more)

### Community 8 - "paleta-comandos.tsx"
Cohesion: 0.09
Nodes (35): acaoBuscar(), acaoBuscarProdutos(), acaoBuscarTarefas(), acaoBuscarLinks(), acaoBuscarEventosSaude(), BarraSuperior(), destacar(), Item (+27 more)

### Community 9 - "QuadroKanban"
Cohesion: 0.06
Nodes (41): acaoArquivarConcluidas(), acaoArquivarUmaColuna(), acaoDefinirImpedimento(), acaoDefinirSubtarefas(), acaoExcluirComentario(), acaoMoverTarefa(), acaoRenomearTarefa(), acaoReordenarColunas() (+33 more)

### Community 10 - "kanban.ts"
Cohesion: 0.15
Nodes (43): ehArquivoDeNota(), tituloDe(), resolverCaminho(), src_lib_caminhos_segmentos, reapontar(), alternarColunaConcluida(), arquivarConcluidas(), arquivarTarefa() (+35 more)

### Community 11 - "links.tsx"
Cohesion: 0.10
Nodes (29): RespostaLinks, DialogoConfirmarComTexto(), CamposLink, ColunaPastasLinks(), comModificador(), contemId(), DialogoImportarFavoritos(), dominioDaUrl() (+21 more)

### Community 12 - "atualizarTudo"
Cohesion: 0.11
Nodes (32): acaoAlternarFavorita(), acaoAlternarFixada(), acaoAlternarTarefaEm(), acaoApagarDaLixeira(), acaoConverterFormato(), acaoCriarCaderno(), acaoCriarEtiqueta(), acaoCriarModelo() (+24 more)

### Community 13 - "cofre-senhas.tsx"
Cohesion: 0.07
Nodes (37): acaoDefinirConfig(), acaoObterConfig(), AvisosDaEntrada(), buscar(), CampoDetalhe(), CampoSenhaDetalhe(), copiar(), CategoriaSaude (+29 more)

### Community 14 - "ArvoreNotas"
Cohesion: 0.18
Nodes (17): acaoDestinoAposExcluir(), acaoListarNotas(), acaoMover(), acaoReordenarCadernosPara(), acaoReordenarNotasPara(), acaoReordenarSecoesPara(), ArvoreNotas(), aoSoltarCaderno() (+9 more)

### Community 15 - "acoes-links.ts"
Cohesion: 0.11
Nodes (29): acaoAtualizarFavicons(), acaoAtualizarLink(), acaoCriarLink(), acaoCriarPastaLink(), acaoExcluirLink(), acaoExcluirPastaLink(), acaoExcluirVarios(), acaoExportarFavoritosHtml() (+21 more)

### Community 16 - "(app)/lixeira/page.tsx"
Cohesion: 0.67
Nodes (3): dynamic, TelaLixeira(), listarLixeira()

### Community 17 - "hoje/page.tsx"
Cohesion: 0.50
Nodes (4): dynamic, hojeLocal(), TelaHoje(), HojeKanban()

### Community 18 - "quadros.ts"
Cohesion: 0.05
Nodes (64): dynamic, TelaEtiquetasKanban(), dynamic, TelaDoArquivo(), dynamic, TelaDoQuadro(), src_lib_caminhos_eharquivodenota, src_lib_caminhos_ehpastainterna (+56 more)

### Community 19 - "next"
Cohesion: 0.09
Nodes (23): nextConfig, next, acaoApagarDeVezDaLixeiraLinks(), acaoEsvaziarLixeiraLinks(), acaoRestaurarDaLixeiraLinks(), dynamic, TelaInicialDoKanban(), ArquivoKanban() (+15 more)

### Community 20 - "arvore-notas.tsx"
Cohesion: 0.13
Nodes (24): acaoBuscarSemanticaNoCaderno(), acaoExportarSecao(), acaoReordenar(), Acao, Alvo, baixarPasta(), LinhaCaderno(), LinhaPagina() (+16 more)

### Community 21 - "acoes-senhas.ts"
Cohesion: 0.11
Nodes (36): acaoAdicionarAnexo(), acaoAtualizarEntrada(), acaoBaixarAnexo(), acaoBaixarCofre(), acaoCriarEntrada(), acaoCriarGrupo(), acaoDefinirTravaDaSessao(), acaoExcluirCofre() (+28 more)

### Community 22 - "rotas.ts"
Cohesion: 0.13
Nodes (25): App, BarraAplicacoes(), irParaKanban(), AtalhosDoHub(), CascaInterna(), encontrarPastaLink(), ColunaQuadros(), baixarTudo() (+17 more)

### Community 23 - "saude.tsx"
Cohesion: 0.05
Nodes (50): acaoApagarDeVezDaLixeiraSaude(), acaoEsvaziarLixeiraSaude(), acaoListarLixeiraSaude(), acaoMudarStatusEvento(), acaoRemoverAnexo(), acaoRestaurarDaLixeiraSaude(), ColunaSaude(), COR_STATUS (+42 more)

### Community 24 - "manifest.json"
Cohesion: 0.07
Nodes (26): action, default_icon, default_popup, background, service_worker, content_scripts, content_security_policy, extension_pages (+18 more)

### Community 25 - "acoes-kanban.ts"
Cohesion: 0.07
Nodes (63): acaoAdicionarComentario(), acaoAlternarColunaConcluida(), acaoArquivarTarefa(), acaoCriarColuna(), acaoCriarQuadro(), acaoCriarSprint(), acaoCriarTarefa(), acaoDefinirArquivarApos() (+55 more)

### Community 26 - "salvar-link/page.tsx"
Cohesion: 0.17
Nodes (13): dynamic, GET(), paraExtensao(), PastaParaExtensao, dynamic, PaginaLinks(), dynamic, PaginaLinksPopup() (+5 more)

### Community 27 - "urlDaNota"
Cohesion: 0.16
Nodes (16): acaoCriarNotaRapida(), carimboDeNotaRapida(), AbaItem(), AbasNotas(), irPara(), BotaoNotaRapida(), criar(), GrafoDeNotas() (+8 more)

### Community 28 - "arquivos.ts"
Cohesion: 0.11
Nodes (36): TelaDaEtiqueta(), dynamic, Inicio(), dynamic, TelaDeTarefas(), buscar(), caminhosDeNota(), garantirEstrutura() (+28 more)

### Community 29 - "barra-formatacao.tsx"
Cohesion: 0.15
Nodes (20): atalhoDeFormatacao(), BarraFormatacao(), inserirTabela(), Ferramenta, FERRAMENTAS_MARKDOWN, FERRAMENTAS_TEXTO, aoTeclarNoCampo(), alternarTarefa() (+12 more)

### Community 30 - "compras.tsx"
Cohesion: 0.12
Nodes (19): ESTILO_PRIORIDADE, formatarData(), LinhaHistorico, LinhaProduto, LojaEmEdicao, SeletorCategoria(), SeletorPrioridade(), ImagemBuscada (+11 more)

### Community 31 - "exportar.ts"
Cohesion: 0.27
Nodes (12): GET(), TelaDaSecao(), listarNotas(), nomeDe(), src_lib_caminhos_nomede, cabecalho(), copiarPastaParaZip(), exportarNota() (+4 more)

### Community 32 - "acoes.ts"
Cohesion: 0.07
Nodes (41): acaoCriarDestinoNotaRapida(), acaoDefinirDestinoRecorte(), ASSINATURA_PNG, caminhoValido, destinoNotaRapidaValido(), EXTENSAO_ANEXO_VALIDA, EXTENSAO_IMAGEM_VALIDA, formatoValido (+33 more)

### Community 33 - "compras-app.ts"
Cohesion: 0.19
Nodes (22): adicionarLoja(), alterar(), apagarImagem(), ARQUIVO_DADOS, atualizarCategoria(), atualizarProduto(), criarCategoria(), criarProduto() (+14 more)

### Community 34 - "busca-semantica.ts"
Cohesion: 0.05
Nodes (64): acaoDescartarNotaRapida(), acaoMoverNotaRapida(), acaoRenomear(), reindexarSemPressa(), corpoValido, POST(), dynamic, TelaEtiquetas() (+56 more)

### Community 35 - "sugestoes-editor.ts"
Cohesion: 0.11
Nodes (26): ICONE, SugestoesEditor(), TITULO, aplicarComando(), aplicarLink(), aplicarPlaceholdersDeModelo(), casa(), Comando (+18 more)

### Community 36 - "visualizador-markdown.tsx"
Cohesion: 0.15
Nodes (12): comLinha(), ICONE_DO_CALLOUT, PLUGINS_REHYPE, PLUGINS_REMARK, textoDoNo(), tituloOuMarcaVazia(), VisualizadorMarkdown, ehDesenho() (+4 more)

### Community 37 - "lista-quadros.tsx"
Cohesion: 0.16
Nodes (15): BotaoApp(), DialogoCor(), DialogoIcone(), Acao, LinhaQuadro(), Menu(), abrir(), calcularPosicao() (+7 more)

### Community 38 - "acoes-compras.ts"
Cohesion: 0.17
Nodes (19): acaoAtualizarCategoria(), acaoAtualizarProduto(), acaoCriarCategoria(), acaoExcluirCategoria(), acaoExcluirProduto(), acaoMudarEstadoProduto(), acaoReordenarCategorias(), comTratamento() (+11 more)

### Community 39 - "avisos-prazo.tsx"
Cohesion: 0.24
Nodes (12): acaoTarefasComPrazoVencendo(), Avisados, AvisosDePrazo, guardarAvisados(), hojeLocalISO(), lerAvisados(), lerPreferencia(), tituloDoAviso() (+4 more)

### Community 40 - "forca-senha.ts"
Cohesion: 0.14
Nodes (18): BarraForca(), GeradorSenha(), gerar(), SeloForca(), embaralhar(), Forca, gerarFrase(), gerarSenha() (+10 more)

### Community 41 - "nota.tsx"
Cohesion: 0.13
Nodes (16): acaoDefinirEtiquetasDaNota(), Estado, EXTENSAO_POR_TIPO, IndicadorEstado(), SeletorEtiquetas(), alternar(), contarCaracteres(), contarPalavras() (+8 more)

### Community 42 - "PaginaNota"
Cohesion: 0.17
Nodes (13): acaoColarImagem(), acaoSalvarAnexoDaNota(), acaoSalvarDesenho(), acaoSalvarNota(), acaoTitulosDeNotas(), arquivoParaBase64(), PaginaNota(), anexarArquivos() (+5 more)

### Community 43 - "SalvarProdutoPopup"
Cohesion: 0.19
Nodes (18): acaoAcharProdutoPorUrl(), acaoAdicionarLoja(), acaoBuscarDadosDoProduto(), acaoCriarProduto(), arquivoParaBase64(), DialogoComprado(), enviar(), DialogoProduto() (+10 more)

### Community 44 - "entradaDaNota"
Cohesion: 0.11
Nodes (28): acaoDefinirCorDaTarefa(), acaoDefinirDependencias(), acaoDefinirEstimativa(), acaoDefinirPrazo(), acaoDefinirPrioridade(), acaoDefinirRecorrencia(), acaoDefinirSprintDaTarefa(), acaoLerTarefa() (+20 more)

### Community 45 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 46 - "historico.ts"
Cohesion: 0.21
Nodes (15): acaoListarVersoes(), acaoRestaurarVersao(), acompanharHistoricos(), extensaoDe(), src_lib_caminhos_extensaode, apagarHistorico(), chaveDe(), lerVersao() (+7 more)

### Community 47 - "popup.js"
Cohesion: 0.13
Nodes (16): abaCompras, abaLinks, abaSenhas, bolinha, botaoAbrir, carregarCompras(), carregarLinks(), comprasCarregando (+8 more)

### Community 48 - "package.json"
Cohesion: 0.10
Nodes (19): name, private, version, argon2, eslint, eslint-config-next, @excalidraw/excalidraw, @huggingface/transformers (+11 more)

### Community 49 - "atalhos.tsx"
Cohesion: 0.22
Nodes (12): FolhaAtalhos(), AcoesContexto, Atalho, AtalhosProvedor(), aoTeclar(), comboDoEvento(), emCampoDeTexto(), ListaContexto (+4 more)

### Community 50 - "normalizarUrl"
Cohesion: 0.25
Nodes (7): acaoAcharDuplicado(), acaoBuscarMetadadosUrl(), FormularioEntrada(), buscarFavicon(), DialogoLink(), buscarMetadados(), normalizarUrl()

### Community 51 - "arrastar.ts"
Cohesion: 0.15
Nodes (11): FORMATO_CADERNO, FORMATO_COLUNA_KANBAN, FORMATO_ENTRADA_SENHA, FORMATO_GRUPO_SENHA, FORMATO_LINK, FORMATO_PAGINA, FORMATO_PASTA_LINK, FORMATO_QUADRO (+3 more)

### Community 52 - "acaoStatusCofre"
Cohesion: 0.20
Nodes (10): acaoCriarCofre(), acaoDestrancar(), acaoImportarCofre(), acaoObterArvore(), acaoStatusCofre(), dynamic, AppSenhas(), lerArquivoBase64() (+2 more)

### Community 53 - "popup-links.tsx"
Cohesion: 0.31
Nodes (8): acaoMarcarComoAberto(), contarLinks(), dominioDaUrl(), GrupoPasta(), LinhaLink(), PopupLinks(), abrir(), Link

### Community 54 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, argon2, clsx, @excalidraw/excalidraw, @huggingface/transformers, jszip, kdbxweb, lucide-react (+7 more)

### Community 55 - "painel-historico.tsx"
Cohesion: 0.26
Nodes (10): acaoLerVersao(), descreverTamanho(), PainelHistorico(), escolher(), restaurar(), Visao, diferencaDeLinhas(), diferencaPorLcs() (+2 more)

### Community 56 - "senhas-comum.tsx"
Cohesion: 0.15
Nodes (12): acaoTrocarSenhaMestra(), DialogoExcluirCofre(), DialogoExcluirEntrada(), DialogoExcluirGrupo(), DialogoNovoGrupo(), DialogoTrocarSenha(), enviar(), encontrarGrupo() (+4 more)

### Community 57 - "Popup da Extensão"
Cohesion: 0.18
Nodes (14): Iframe de Compras do Popup, Iframe de Links do Popup, Painel de Senhas do Popup, Popup da Extensão, Script popup.js, Service Worker background.js, Extensão do Navegador, Content Script content.js (+6 more)

### Community 58 - "etiquetas.ts"
Cohesion: 0.11
Nodes (19): ref_node_fs, ref_node_path, DE_FORA, destino, origem, TIPOS, TIPOS, TIPOS (+11 more)

### Community 59 - "DialogoSaude"
Cohesion: 0.47
Nodes (5): DialogoSaude(), verificarVazamentos(), diasDesde(), contarVazamentos(), sha1Hex()

### Community 60 - "Armazenamento de Notas em Arquivos"
Cohesion: 0.25
Nodes (8): Anotações, Hierarquia Caderno-Seção-Página, Armazenamento de Notas em Arquivos, Backup Automático via OneDrive, DADOS_PATH, Índice de Metadados Reconstruível, Sistema sem Banco de Dados, Validação de Caminhos em caminhos.ts

### Community 61 - "salvar-produto/page.tsx"
Cohesion: 0.29
Nodes (8): dynamic, PaginaCompras(), dynamic, PaginaSalvarProduto(), acharPorUrl(), buscarProdutos(), lerDados(), obterDados()

### Community 62 - "PainelLixeira"
Cohesion: 0.23
Nodes (12): acaoEsvaziarLixeira(), acaoExcluirDaLixeiraDeVez(), acaoObterHistorico(), acaoObterLixeira(), acaoRestaurarDaLixeira(), acaoRestaurarVersao(), DialogoHistorico(), restaurar() (+4 more)

### Community 63 - "totp.ts"
Cohesion: 0.29
Nodes (10): RFC-6238, CampoTotp(), atualizar(), ConfigTotp, decodificarBase32(), gerarCodigoTotp(), interpretarOtp(), interpretarUri() (+2 more)

### Community 64 - "ColunaLinks"
Cohesion: 0.25
Nodes (6): acaoVerificarLinks(), ColunaLinks(), reordenarComArrasto(), verificarLinksQuebrados(), opcoesDePastaMenu(), ordenarLinks()

### Community 65 - "importar-favoritos.ts"
Cohesion: 0.50
Nodes (4): analisarBookmarksHtml(), decodificarEntidades(), ENTIDADES_HTML, NoImportado

### Community 66 - "acaoCriarEtiquetaKanban"
Cohesion: 0.50
Nodes (5): acaoCriarEtiquetaKanban(), GerenciadorEtiquetasKanban(), criar(), criarEtiquetaKanban(), gerarId()

### Community 67 - "acaoDefinirEtiquetasDaTarefa"
Cohesion: 0.67
Nodes (4): acaoDefinirEtiquetasDaTarefa(), SeletorEtiquetasKanban(), alternar(), definirEtiquetasDaTarefa()

### Community 68 - "DialogoNome"
Cohesion: 0.50
Nodes (3): DialogoNome(), DialogoNovoCaderno(), confirmar()

### Community 69 - "Design System: Meu bloco de anotações"
Cohesion: 0.25
Nodes (8): Carimbo de Cor do Cartão, Design System: Meu bloco de anotações, A Lombada Colorida, Regra da Cor Única, Regra da Família Única, Regra da Lombada, Regra do Plano em Repouso, Seis Temas

### Community 70 - "content.js"
Cohesion: 0.36
Nodes (8): acharCampoUsuario(), aoEnviarFormulario(), conferirPendente(), criarBanner(), enviarMensagem(), mostrarSalvarSenha(), observarFormularios(), sugerirAutopreenchimento()

### Community 71 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, eslint, eslint-config-next, @eslint/eslintrc, tailwindcss, @tailwindcss/postcss, @types/node, @types/react (+2 more)

### Community 72 - "Meu bloco de anotações"
Cohesion: 0.18
Nodes (11): Acesso Restrito ao Loopback, Aplicativo PWA, Desenho Excalidraw Embutido em PNG, Exportação de Notas, Histórico de Versões, Lixeira com Metadados Preservados, Meu bloco de anotações, Nota Rápida (+3 more)

### Community 73 - "Project Knowledge Graph"
Cohesion: 0.28
Nodes (9): Graphify Architecture Report, graphify explain, Graphify Project Guidance, Graphify Incremental Update, graphify path, graphify query, Installed Graphify Skill, Graphify Wiki Index (+1 more)

### Community 74 - "Hub de Aplicações Independentes"
Cohesion: 0.33
Nodes (7): Árvore de Grupos e Pastas, Hub de Aplicações Independentes, Kanban, Gerenciador de Links, Paleta de Comandos, Histórico de Saúde, Cofre de Senhas KeePass

### Community 75 - "acaoCriarPagina"
Cohesion: 0.29
Nodes (8): acaoCriarPagina(), acaoCriarPaginaFlutuante(), carimboDeAgora(), criarPagina(), criarPaginaFlutuante(), DialogoModeloDePagina(), criar(), urlDaNotaFlutuante()

### Community 76 - "eslint.config.mjs"
Cohesion: 0.25
Nodes (7): compat, __dirname, eslintConfig, __filename, @eslint/eslintrc, ref_path, ref_url

### Community 77 - "Q: Quero que primeiro você entenda todo o projeto, leia o repositório todo"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Quero que primeiro você entenda todo o projeto, leia o repositório todo, Source Nodes

### Community 78 - "rehype-callouts.ts"
Cohesion: 0.39
Nodes (7): ref_hast, caminhar(), ehElemento(), marcarCallout(), rehypeCallouts(), TipoDeCallout, TIPOS_DE_CALLOUT

### Community 79 - "app/layout.tsx"
Cohesion: 0.25
Nodes (6): src_app_globals, fonteLeitura, fonteMono, fonteUi, metadata, viewport

### Community 80 - "LocalizarNota"
Cohesion: 0.39
Nodes (8): acharOcorrencias(), escaparParaRegex(), LocalizarNota(), aoTeclar(), fechar(), proxima(), substituirAtual(), substituirTodas()

### Community 81 - "editor-teclado.ts"
Cohesion: 0.61
Nodes (7): continuarLista(), duplicarLinha(), faixaDasLinhas(), fimDaLinha(), indentar(), inicioDaLinha(), moverLinha()

### Community 82 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, prebuild, predev, start

### Community 83 - "atalho-links.tsx"
Cohesion: 0.33
Nodes (3): dynamic, AtalhoDeLinks(), BlocoBookmarklet()

### Community 84 - "Símbolo de documento branco"
Cohesion: 0.33
Nodes (7): Tela vetorial de 32 por 32 pixels, Canto de página dobrado verde-claro, Notas e documentos, Ícone vetorial do aplicativo, Quadrado arredondado verde-azulado, Três linhas de texto estilizadas, Símbolo de documento branco

### Community 85 - "fundo-editor.ts"
Cohesion: 0.38
Nodes (6): aplicar(), ehFundo(), FundoEditor, OPCOES, ROTULO_FUNDO, useFundoEditor()

### Community 86 - "Serviço Docker meu-onenote"
Cohesion: 0.47
Nodes (6): Volume de Notas no Host, Mapeamento de Porta em Loopback, Serviço Docker meu-onenote, Configuração de Fuso Horário, DADOS_HOST_PATH, Implantação via Docker

### Community 87 - "Endereço Base do Aplicativo"
Cohesion: 0.33
Nodes (6): Endereço Base do Aplicativo, Script opcoes.js, Página de Preferências da Extensão, Estado Offline do Painel Lateral, Painel Lateral de Links, Script sidepanel.js

### Community 88 - "Símbolo de documento branco"
Cohesion: 0.40
Nodes (6): Ícone do aplicativo, Canto de página dobrado, Notas e documentos, Quadrado arredondado verde-azulado, Três linhas de texto estilizadas, Símbolo de documento branco

### Community 89 - "exportarHistorico"
Cohesion: 0.22
Nodes (9): jszip, zod, GET(), dynamic, PaginaImprimirSaude(), HistoricoParaImprimir(), dataLegivel(), exportarHistorico() (+1 more)

### Community 90 - "White Document Symbol"
Cohesion: 0.33
Nodes (6): Document Text Lines, Folded Page Corner, Apple Touch Icon Asset, Note Taking, Teal Rounded-Square Background, White Document Symbol

### Community 91 - "acaoDefinirDestinoLink"
Cohesion: 0.83
Nodes (4): acaoDefinirDestinoLink(), acaoSalvarLinkDoClipper(), SalvarLinkPopup(), salvar()

### Community 92 - "sumario.ts"
Cohesion: 0.53
Nodes (5): extrairTitulos(), identificadorDeTitulo(), limparMarcacao(), podeSerTituloSetext(), Titulo

### Community 93 - "Product Specification"
Cohesion: 0.29
Nodes (7): Densidade Ajustável, Layout Desktop em Colunas, O Disco é a Verdade, Local-first e sem nuvem, Product Specification, Regra de Desempenho sem Revalidação da Casca, Serviço Nativo do Windows

### Community 95 - "[evento]/[arquivo]/route.ts"
Cohesion: 0.50
Nodes (4): GET(), INLINE, TIPOS, caminhoDoAnexo()

### Community 97 - "useZoomTexto"
Cohesion: 0.60
Nodes (3): aplicar(), clampar(), useZoomTexto()

### Community 98 - "Ícone do aplicativo"
Cohesion: 0.50
Nodes (4): Acesso e segurança, Ícone do aplicativo, Quadrado arredondado verde-azulado, Símbolo de chave branca

### Community 99 - "16-Pixel Icon Asset"
Cohesion: 0.50
Nodes (4): Access and Security, 16-Pixel Icon Asset, Teal Square Background, White Key Symbol

### Community 100 - "Ícone do aplicativo"
Cohesion: 0.50
Nodes (4): Acesso e segurança, Ícone do aplicativo, Fundo verde-azulado, Símbolo de chave branca

### Community 101 - "48-Pixel Icon Asset"
Cohesion: 0.50
Nodes (4): Access and Security, 48-Pixel Icon Asset, Teal Rounded-Square Background, White Key Symbol

### Community 102 - "opcoes.js"
Cohesion: 0.25
Nodes (6): aviso, botao, botaoSincronizar, campo, campoSincronizar, statusSincronizacao

### Community 105 - "SumarioNota"
Cohesion: 0.67
Nodes (3): SumarioNota(), aoRolar(), noFimDaRolagem()

### Community 106 - "background.js"
Cohesion: 0.30
Nodes (14): abrirNaAbaAtual(), chamar(), encontrarBarraDeFavoritos(), executarSincronizacaoFavoritosChrome(), garantirLink(), garantirPasta(), garantirPastaRaiz(), garantirPosicao() (+6 more)

### Community 107 - "InicioLinks"
Cohesion: 1.00
Nodes (3): InicioLinks(), useOrdemDosGrupos(), mover()

## Knowledge Gaps
- **390 isolated node(s):** `__filename`, `__dirname`, `compat`, `eslintConfig`, `manifest_version` (+385 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 532 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `senhas.ts`, `acoes-saude.ts`, `saude-app.ts`, `tipos.ts`, `ui.tsx`, `paleta-comandos.tsx`, `links.tsx`, `acoes-links.ts`, `quadros.ts`, `arvore-notas.tsx`, `rotas.ts`, `saude.tsx`, `acoes-kanban.ts`, `salvar-link/page.tsx`, `urlDaNota`, `compras.tsx`, `exportar.ts`, `acoes.ts`, `busca-semantica.ts`, `visualizador-markdown.tsx`, `lista-quadros.tsx`, `acoes-compras.ts`, `avisos-prazo.tsx`, `nota.tsx`, `package.json`, `painel-historico.tsx`, `etiquetas.ts`, `app/layout.tsx`, `atalho-links.tsx`, `exportarHistorico`, `[evento]/[arquivo]/route.ts`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Why does `react` connect `ui.tsx` to `tipos.ts`, `paleta-comandos.tsx`, `links.tsx`, `cofre-senhas.tsx`, `next`, `arvore-notas.tsx`, `rotas.ts`, `saude.tsx`, `urlDaNota`, `barra-formatacao.tsx`, `compras.tsx`, `acoes.ts`, `busca-semantica.ts`, `sugestoes-editor.ts`, `visualizador-markdown.tsx`, `lista-quadros.tsx`, `avisos-prazo.tsx`, `nota.tsx`, `package.json`, `atalhos.tsx`, `popup-links.tsx`, `painel-historico.tsx`, `senhas-comum.tsx`, `atalho-links.tsx`, `fundo-editor.ts`, `useZoomTexto`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `QuadroKanban()` connect `QuadroKanban` to `atualizarIndice`, `CartaoTarefa`, `tipos.ts`, `acoes-compras.ts`, `atualizarTudo`, `entradaDaNota`, `quadros.ts`, `next`, `acoes-kanban.ts`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `QuadroKanban()` (e.g. with `limparSelecao()` and `passaNoFiltro()`) actually correct?**
  _`QuadroKanban()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `PaginaNota()` (e.g. with `aoFechar()` and `aoTeclar()`) actually correct?**
  _`PaginaNota()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `__filename`, `__dirname`, `compat` to the rest of the system?**
  _390 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `senhas.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05326460481099656 - nodes in this community are weakly interconnected._