import { useState } from "react";
import {
    Car, Users, MapPin, Wrench, FileText, Calendar, Fuel,
    ClipboardList, BarChart3, Building2, GraduationCap,
    HelpCircle, ChevronDown, ChevronRight, Search
} from "lucide-react";
import "./Help.css";

type HelpSection = {
    id: string;
    icon: React.ReactNode;
    title: string;
    description: string;
    steps: {
        title: string;
        description: string;
        tips?: string[];
    }[];
};

const HELP_SECTIONS: HelpSection[] = [
    {
        id: "vehicles",
        icon: <Car size={20} />,
        title: "Veículos",
        description: "Cadastro e gestão da frota municipal",
        steps: [
            {
                title: "Cadastrar novo veículo",
                description: "Acesse 'Veículos' no menu lateral → Clique em 'Novo veículo' → Preencha os dados: placa, modelo, marca, ano, capacidade de passageiros e odômetro inicial → Selecione o tipo de propriedade (próprio, alugado, leasing ou terceirizado) → Clique em 'Salvar'.",
                tips: [
                    "A placa deve ser única no sistema",
                    "O odômetro inicial será usado para calcular a quilometragem mensal"
                ]
            },
            {
                title: "Editar veículo existente",
                description: "Na lista de veículos, localize o veículo desejado → Clique no botão 'Editar' → Altere os campos necessários → Clique em 'Atualizar'."
            },
            {
                title: "Alterar status do veículo",
                description: "Edite o veículo e altere o status para: Disponível (pronto para uso), Em uso (em viagem), Manutenção (em reparo) ou Inativo (fora de operação).",
                tips: [
                    "Veículos em manutenção não aparecem para seleção em novas viagens",
                    "O status muda automaticamente quando uma ordem de serviço é aberta"
                ]
            },
            {
                title: "Vincular a contrato",
                description: "Para veículos alugados ou de leasing, vincule ao contrato correspondente selecionando no campo 'Contrato atual'."
            }
        ]
    },
    {
        id: "drivers",
        icon: <Users size={20} />,
        title: "Motoristas",
        description: "Cadastro de motoristas e controle de CNH",
        steps: [
            {
                title: "Cadastrar motorista",
                description: "Acesse 'Motoristas' no menu → Preencha: nome completo, CPF, telefone, número da CNH, categoria da CNH e data de validade → O sistema gera automaticamente um código de acesso único → Clique em 'Salvar'.",
                tips: [
                    "O código de acesso é usado pelo motorista para entrar no Portal do Motorista",
                    "O CPF deve ser único por prefeitura"
                ]
            },
            {
                title: "Editar dados do motorista",
                description: "Localize o motorista na lista → Clique em 'Editar' → Atualize os dados necessários → Clique em 'Atualizar'."
            },
            {
                title: "Habilitar viagem livre",
                description: "Ao editar um motorista, marque a opção 'Habilitar viagem livre' para permitir que ele registre viagens sem agendamento prévio pelo Portal do Motorista.",
                tips: [
                    "Viagens livres são úteis para deslocamentos administrativos não planejados",
                    "O motorista precisará registrar odômetro inicial e final"
                ]
            },
            {
                title: "Verificar vencimento de CNH",
                description: "No Dashboard, a seção 'Alertas de Manutenção' mostra CNHs próximas do vencimento. Também é possível filtrar na lista de motoristas."
            }
        ]
    },
    {
        id: "trips",
        icon: <MapPin size={20} />,
        title: "Viagens",
        description: "Agendamento e acompanhamento de viagens",
        steps: [
            {
                title: "Agendar nova viagem",
                description: "Acesse 'Viagens' → Clique em 'Nova viagem' → O assistente guiará você em 5 etapas: (1) Informe origem e destino, (2) Defina data/hora de saída e retorno previsto, (3) Adicione passageiros com nome, CPF e necessidades especiais, (4) Selecione veículo e motorista disponíveis, (5) Revise e confirme.",
                tips: [
                    "Veículos em manutenção não aparecem para seleção",
                    "Adicione passageiros individualmente com todos os dados para maior controle"
                ]
            },
            {
                title: "Acompanhar viagem em andamento",
                description: "Acesse 'Rastreamento ao Vivo' → Selecione a viagem em andamento → Visualize a posição do veículo no mapa em tempo real.",
                tips: [
                    "O motorista precisa ativar o compartilhamento de localização no Portal",
                    "As posições são atualizadas a cada 12 segundos"
                ]
            },
            {
                title: "Registrar conclusão",
                description: "Quando a viagem retorna, o motorista pode marcar como concluída pelo Portal. Ou o gestor pode editar a viagem e alterar status para 'Concluída', informando odômetro final."
            },
            {
                title: "Registrar ocorrência",
                description: "Durante ou após a viagem, acesse os detalhes e clique em 'Registrar ocorrência' → Descreva o incidente → A ocorrência ficará vinculada à viagem para futuras consultas."
            }
        ]
    },
    {
        id: "maintenance",
        icon: <Wrench size={20} />,
        title: "Manutenção",
        description: "Ordens de serviço, estoque e planos preventivos",
        steps: [
            {
                title: "Criar ordem de serviço",
                description: "Acesse 'Manutenção' → Aba 'Ordens de Serviço' → Clique em 'Nova OS' → Selecione o veículo → Escolha o tipo (Corretiva, Preventiva ou Pneus) → Defina a prioridade → Descreva o serviço necessário → Clique em 'Criar'.",
                tips: [
                    "O veículo terá status alterado para 'Manutenção' automaticamente",
                    "Ordens críticas aparecem destacadas no Dashboard"
                ]
            },
            {
                title: "Gerenciar estoque de peças",
                description: "Aba 'Estoque' → Cadastre peças com nome, código (SKU), unidade de medida e estoque mínimo → Registre entradas e saídas → O sistema alertará quando estoque estiver baixo."
            },
            {
                title: "Configurar plano preventivo",
                description: "Aba 'Planos de Manutenção' → Clique em 'Novo plano' → Defina nome do serviço → Escolha gatilho: por quilometragem (ex: a cada 10.000 km) ou por tempo (ex: a cada 6 meses) → Vincule a um veículo ou deixe em branco para aplicar a todos.",
                tips: [
                    "O Dashboard mostrará alertas quando planos estiverem vencidos",
                    "Registre a última execução para o sistema calcular a próxima"
                ]
            },
            {
                title: "Concluir ordem de serviço",
                description: "Na lista de ordens, localize a OS → Clique em 'Concluir' → Informe custo total e odômetro atual → O veículo volta automaticamente para 'Disponível'."
            }
        ]
    },
    {
        id: "scheduling",
        icon: <Calendar size={20} />,
        title: "Escala de Motoristas",
        description: "Bloqueios de disponibilidade e agenda",
        steps: [
            {
                title: "Cadastrar bloqueio",
                description: "Acesse 'Escala' → Selecione o motorista → Escolha o tipo: Férias, Folga, Atestado médico, Treinamento ou Bloqueio administrativo → Defina data/hora inicial e final → Adicione observações se necessário → Clique em 'Criar bloqueio'.",
                tips: [
                    "Marque 'Dia inteiro' para bloquear o dia completo",
                    "Anexe atestados ou documentos comprobatórios"
                ]
            },
            {
                title: "Consultar motoristas disponíveis",
                description: "Na seção 'Quem está livre?' → Informe o período desejado → Clique em 'Consultar' → O sistema mostrará todos os motoristas sem bloqueios no período."
            },
            {
                title: "Visualizar calendário do motorista",
                description: "Na seção 'Calendário do motorista' → Selecione o motorista → Defina o período → Clique em 'Ver agenda' → Visualize viagens agendadas e bloqueios em uma timeline."
            },
            {
                title: "Cancelar bloqueio",
                description: "Na lista de bloqueios, localize o registro → Clique em 'Cancelar' → Confirme a ação → O motorista voltará a estar disponível no período."
            }
        ]
    },
    {
        id: "fuel",
        icon: <Fuel size={20} />,
        title: "Combustível",
        description: "Postos credenciados e registro de abastecimentos",
        steps: [
            {
                title: "Cadastrar posto credenciado",
                description: "Acesse 'Postos de Combustível' → Clique em 'Novo posto' → Informe nome, CNPJ e endereço → Clique em 'Salvar'.",
                tips: [
                    "Apenas postos cadastrados podem ser selecionados nos abastecimentos",
                    "Desative postos que não são mais utilizados"
                ]
            },
            {
                title: "Registrar abastecimento (Gestor)",
                description: "Acesse 'Viagens' ou 'Dashboard' → Use a seção de abastecimentos → Selecione veículo, motorista e posto → Informe data, litros e anexe foto do cupom fiscal."
            },
            {
                title: "Registrar abastecimento (Motorista)",
                description: "No Portal do Motorista → Seção 'Abastecimento' → Selecione o veículo (lista baseada nas viagens do motorista) → Escolha o posto credenciado → Informe litros e data → Anexe foto do cupom → Envie."
            }
        ]
    },
    {
        id: "contracts",
        icon: <FileText size={20} />,
        title: "Contratos",
        description: "Gestão de contratos de aluguel e leasing",
        steps: [
            {
                title: "Cadastrar contrato",
                description: "Acesse 'Contratos' → Clique em 'Novo contrato' → Informe: número do contrato, nome do fornecedor, data de início e fim, valor mensal → Adicione observações → Clique em 'Salvar'.",
                tips: [
                    "Contratos próximos do vencimento aparecem no Dashboard",
                    "Vincule veículos ao contrato na edição do veículo"
                ]
            },
            {
                title: "Cadastrar período de aluguel",
                description: "Em 'Períodos de Aluguel' → Associe um período específico a um contrato → Defina datas e veículos incluídos → Útil para contratos com múltiplos períodos ou renovações."
            },
            {
                title: "Acompanhar vencimentos",
                description: "O Dashboard exibe contratos próximos do vencimento. Também é possível filtrar na lista de contratos por status (Ativo, Vencido, Cancelado)."
            }
        ]
    },
    {
        id: "transport",
        icon: <GraduationCap size={20} />,
        title: "Transporte Escolar",
        description: "Rotas, carteirinhas e inscrições",
        steps: [
            {
                title: "Criar formulário de inscrição",
                description: "Acesse 'Templates de Formulário' → Clique em 'Novo formulário' → Defina título e descrição → Adicione campos personalizados (texto, número, seleção, arquivo) → Publique o formulário para gerar link público.",
                tips: [
                    "O link pode ser compartilhado com os responsáveis dos alunos",
                    "Formulários aceitem upload de documentos como comprovante de residência"
                ]
            },
            {
                title: "Gerenciar inscrições recebidas",
                description: "Em 'Submissões de Formulário' → Visualize todas as inscrições → Revise os dados → Aprove ou reprove cada inscrição → Inscrições aprovadas podem gerar carteirinhas."
            },
            {
                title: "Emitir carteirinha de estudante",
                description: "Em 'Carteirinhas' → Localize o aluno aprovado → Clique em 'Emitir carteirinha' → O sistema gera QR Code único → Imprima ou envie digitalmente."
            },
            {
                title: "Validar carteirinha",
                description: "Em 'Validador de Carteira' → Use a câmera para escanear o QR Code → O sistema mostrará dados do aluno e status da carteirinha (válida/inválida)."
            },
            {
                title: "Configurar rotas e escalas",
                description: "Em 'Planejamento de Transporte' → Cadastre rotas com pontos de parada → Vincule motoristas e veículos às rotas → Defina horários de operação → Gere escalas mensais automaticamente."
            }
        ]
    },
    {
        id: "reports",
        icon: <BarChart3 size={20} />,
        title: "Relatórios",
        description: "Análises e exportação de dados",
        steps: [
            {
                title: "Gerar relatório de viagens",
                description: "Acesse 'Relatórios' → Selecione o período desejado → Visualize gráficos de viagens por status, destinos mais frequentes e quilometragem → Use os botões de exportação para baixar em Excel."
            },
            {
                title: "Relatório de combustível",
                description: "Na aba 'Combustível' dos Relatórios → Visualize consumo por veículo → Compare eficiência entre veículos → Identifique padrões de consumo."
            },
            {
                title: "Relatório de ocorrências",
                description: "Em 'Relatórios' → Seção 'Ocorrências' → Liste todos os incidentes no período → Filtre por motorista ou veículo → Exporte para análise."
            },
            {
                title: "Exportar para Excel",
                description: "Em qualquer relatório → Clique no botão 'Exportar' → Selecione as colunas desejadas → O arquivo .xlsx será baixado automaticamente.",
                tips: [
                    "Exportações incluem todos os filtros aplicados",
                    "Use para prestação de contas e auditorias"
                ]
            }
        ]
    },
    {
        id: "driver-portal",
        icon: <Users size={20} />,
        title: "Portal do Motorista",
        description: "Acesso exclusivo para motoristas",
        steps: [
            {
                title: "Acessar o portal",
                description: "Acesse /driver-portal → Informe o código de acesso fornecido pelo gestor → Clique em 'Entrar'.",
                tips: [
                    "O código é gerado automaticamente no cadastro do motorista",
                    "Em caso de perda, o gestor pode consultar na lista de motoristas"
                ]
            },
            {
                title: "Visualizar viagens agendadas",
                description: "No portal, a seção 'Minhas Viagens' mostra todas as viagens atribuídas ao motorista, com origem, destino, horários e passageiros."
            },
            {
                title: "Concluir viagem",
                description: "Na viagem em andamento → Clique em 'Concluir' → A viagem será marcada como finalizada e aparecerá no histórico."
            },
            {
                title: "Ativar rastreamento GPS",
                description: "Na seção 'Rastreamento' → Clique em 'Ativar' → Permita acesso à localização no navegador → Sua posição será enviada automaticamente durante viagens em andamento."
            },
            {
                title: "Registrar viagem livre",
                description: "Na seção 'Viagem Livre' (se habilitado) → Selecione o veículo → Tire foto do odômetro inicial → Clique em 'Iniciar' → Ao finalizar, informe odômetro final e tire foto → Clique em 'Encerrar'."
            },
            {
                title: "Registrar abastecimento",
                description: "Na seção 'Abastecimento' → Selecione o veículo → Escolha o posto credenciado → Informe litros e data → Anexe foto do cupom fiscal → Clique em 'Registrar'."
            }
        ]
    },
    {
        id: "admin",
        icon: <Building2 size={20} />,
        title: "Administração",
        description: "Usuários, prefeituras e configurações",
        steps: [
            {
                title: "Cadastrar novo usuário",
                description: "Acesse 'Usuários' (apenas administradores) → Clique em 'Novo usuário' → Informe email e senha → Selecione o papel: Administrador (acesso total) ou Operador (acesso limitado) → Vincule à prefeitura → Clique em 'Salvar'."
            },
            {
                title: "Gerenciar prefeituras",
                description: "Em 'Prefeituras' (apenas superadmin) → Cadastre novas prefeituras com nome, CNPJ e dados de contato → Cada prefeitura tem dados isolados (multi-tenancy)."
            },
            {
                title: "Alterar minha senha",
                description: "Clique no seu nome no canto superior → Selecione 'Alterar senha' → Informe senha atual e nova senha → Confirme."
            }
        ]
    }
];

export const HelpPage = () => {
    const [expandedSections, setExpandedSections] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState("");

    const toggleSection = (id: string) => {
        setExpandedSections((prev) =>
            prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
        );
    };

    const filteredSections = HELP_SECTIONS.filter((section) => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            section.title.toLowerCase().includes(term) ||
            section.description.toLowerCase().includes(term) ||
            section.steps.some(
                (step) =>
                    step.title.toLowerCase().includes(term) ||
                    step.description.toLowerCase().includes(term)
            )
        );
    });

    const expandAll = () => setExpandedSections(HELP_SECTIONS.map((s) => s.id));
    const collapseAll = () => setExpandedSections([]);

    return (
        <div className="help-page">
            <header className="help-header">
                <div className="help-header-content">
                    <div className="help-icon-wrapper">
                        <HelpCircle size={32} />
                    </div>
                    <div>
                        <h1>Central de Ajuda</h1>
                        <p>Guia completo de uso do sistema de gestão de frotas municipais</p>
                    </div>
                </div>

                <div className="help-search">
                    <Search size={18} className="help-search-icon" />
                    <input
                        type="text"
                        placeholder="Buscar por funcionalidade..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="help-actions">
                    <button onClick={expandAll} className="help-action-btn">
                        Expandir tudo
                    </button>
                    <button onClick={collapseAll} className="help-action-btn">
                        Recolher tudo
                    </button>
                </div>
            </header>

            <div className="help-content">
                {filteredSections.length === 0 && (
                    <div className="help-empty">
                        <p>Nenhum resultado encontrado para "{searchTerm}"</p>
                    </div>
                )}

                <div className="help-grid">
                    {filteredSections.map((section) => {
                        const isExpanded = expandedSections.includes(section.id);

                        return (
                            <div key={section.id} className={`help-section ${isExpanded ? "expanded" : ""}`}>
                                <button
                                    className="help-section-header"
                                    onClick={() => toggleSection(section.id)}
                                    aria-expanded={isExpanded}
                                >
                                    <div className="help-section-icon">{section.icon}</div>
                                    <div className="help-section-info">
                                        <h2>{section.title}</h2>
                                        <p>{section.description}</p>
                                    </div>
                                    <div className="help-section-toggle">
                                        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="help-section-content">
                                        {section.steps.map((step, index) => (
                                            <div key={index} className="help-step">
                                                <div className="help-step-number">{index + 1}</div>
                                                <div className="help-step-content">
                                                    <h3>{step.title}</h3>
                                                    <p>{step.description}</p>
                                                    {step.tips && step.tips.length > 0 && (
                                                        <div className="help-tips">
                                                            <span className="help-tips-label">💡 Dicas:</span>
                                                            <ul>
                                                                {step.tips.map((tip, tipIndex) => (
                                                                    <li key={tipIndex}>{tip}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <footer className="help-footer">
                <p>
                    Precisa de mais ajuda? Entre em contato com o suporte técnico.
                </p>
            </footer>
        </div>
    );
};
