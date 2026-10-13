import { useEffect, useId, useState } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronRight,
  Activity,
  ArrowRight,
  Droplets,
  Zap,
  WashingMachine,
  TriangleAlert,
  CalendarDays,
  MoveUpRight,
} from "lucide-react";
const sets = [
  {
    name: "Hoje",
    values: [102, 117, 111, 134, 126, 124, 128],
    labels: ["08h", "10h", "12h", "14h", "16h", "18h", "Agora"],
    total: "128",
    delta: "6,4",
  },
  {
    name: "Últimos 7 dias",
    values: [102, 117, 111, 134, 126, 124, 128],
    labels: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Hoje"],
    total: "842",
    delta: "6,4",
  },
  {
    name: "Últimos 30 dias",
    values: [
      118, 126, 121, 132, 129, 124, 128, 135, 130, 127, 122, 136, 131, 125, 129,
      133, 127, 124, 138, 132, 129, 126, 121, 130, 128, 134, 125, 127, 123, 128,
    ],
    labels: Array.from({ length: 30 }, (_, i) =>
      i === 29 ? "Hoje" : String(i + 1),
    ),
    total: "3.860",
    delta: "4,1",
  },
];
const tanks = [
  { id: "detergente", name: "Detergente", level: 72, liters: "14,4", days: 9 },
  { id: "amaciante", name: "Amaciante", level: 43, liters: "8,6", days: 5 },
  { id: "alvejante", name: "Alvejante", level: 88, liters: "17,6", days: 14 },
  {
    id: "neutralizante",
    name: "Neutralizante",
    level: 56,
    liters: "11,2",
    days: 7,
  },
];
const machines = [
  {
    id: "M01",
    name: "Lavadora 01",
    state: "Lavando",
    program: "Pesado",
    pct: 68,
    time: "18 min",
  },
  {
    id: "M02",
    name: "Lavadora 02",
    state: "Enxaguando",
    program: "Normal",
    pct: 42,
    time: "12 min",
  },
  {
    id: "M03",
    name: "Lavadora 03",
    state: "Centrifugando",
    program: "Rápido",
    pct: 84,
    time: "4 min",
  },
  {
    id: "M04",
    name: "Lavadora 04",
    state: "Disponível",
    program: "Aguardando ciclo",
    pct: 0,
    time: "Pronta",
  },
  {
    id: "M05",
    name: "Secadora 01",
    state: "Manutenção",
    program: "Fora de operação",
    pct: 0,
    time: "Ver ocorrência",
  },
];
export function AreaChart({
  values,
  labels,
  title = "Consumo de produtos",
}: {
  values: number[];
  labels: string[];
  title?: string;
}) {
  const id = useId().replace(/:/g, "");
  const [active, setActive] = useState<number | null>(null);
  const w = 760,
    h = 190,
    max = 200;
  const points = values.map((v, i) => ({
    x: (i * w) / (values.length - 1),
    y: h - (v / max) * h,
  }));
  const line = points.reduce(
    (d, p, i) =>
      i === 0
        ? `M${p.x},${p.y}`
        : d +
          ` C${(points[i - 1].x + p.x) / 2},${points[i - 1].y} ${(points[i - 1].x + p.x) / 2},${p.y} ${p.x},${p.y}`,
    "",
  );
  const compare = points
    .map((p, i) => `${i ? "L" : "M"}${p.x},${h - ((values[i] + 12) / max) * h}`)
    .join(" ");
  const sample =
    values.length > 10
      ? labels.filter((_, i) => i % 5 === 0 || i === labels.length - 1)
      : labels;
  return (
    <div className="p-chart" onMouseLeave={() => setActive(null)}>
      <div className="p-chart-grid" aria-hidden="true">
        {[200, 150, 100, 50].map((v) => (
          <span key={v}>{v}</span>
        ))}
      </div>
      <div className="p-chart-canvas">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${title}. ${values.map((v, i) => `${labels[i]}: ${v} litros`).join("; ")}`}
        >
          <defs>
            <linearGradient id={"area" + id} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#0EA5E9" stopOpacity=".24" />
              <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75].map((y) => (
            <line
              key={y}
              x1="0"
              x2={w}
              y1={h * y}
              y2={h * y}
              className="p-grid-line"
            />
          ))}
          <path d={compare} fill="none" className="p-compare-line" />
          <path d={line + ` L${w},${h} L0,${h} Z`} fill={`url(#area${id})`} />
          <path
            d={line}
            fill="none"
            stroke="#0EA5E9"
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
          />
          {active !== null && (
            <>
              <line
                x1={points[active].x}
                x2={points[active].x}
                y1="0"
                y2={h}
                stroke="#0EA5E9"
                strokeDasharray="4 4"
              />
              <circle
                cx={points[active].x}
                cy={points[active].y}
                r="5"
                fill="#0EA5E9"
                stroke="var(--ws-surface)"
                strokeWidth="3"
              />
            </>
          )}
        </svg>
        <div className="p-chart-targets">
          {values.map((v, i) => (
            <button
              key={i}
              aria-label={`${labels[i]}: ${v} litros`}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              onMouseEnter={() => setActive(i)}
              onClick={() => setActive(i)}
            />
          ))}
        </div>
        {active !== null && (
          <div
            className="p-chart-tooltip"
            role="status"
            style={{
              left: `${Math.min(85, Math.max(8, (active / (values.length - 1)) * 100))}%`,
            }}
          >
            <span>{labels[active]}</span>
            <strong>{values[active]} L</strong>
          </div>
        )}
        <div className="p-chart-axis">
          {sample.map((x, i) => (
            <span key={i}>{x}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
function EnergySummary() {
  const [cost, setCost] = useState("Configure a tarifa");
  const [meta, setMeta] = useState("Tarifa ainda não configurada");
  const [unit, setUnit] = useState("—");
  useEffect(() => {
    const update = () => {
      try {
        const cfg = JSON.parse(
          localStorage.getItem("washsenseEnergyConfigV2") ||
            localStorage.getItem("washsenseEnergyConfig") ||
            "null",
        );
        if (!cfg) return;
        const effective =
          (Number(cfg.base || 0) + Number(cfg.flag?.additional_kwh || 0)) /
          0.82;
        setCost(
          (1248 * effective).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          }),
        );
        setMeta(
          `${cfg.agent || cfg.distributor} · ${cfg.subgroup || "Grupo " + cfg.group}`,
        );
        setUnit(
          effective.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
            minimumFractionDigits: 4,
            maximumFractionDigits: 4,
          }) + "/kWh",
        );
      } catch {}
    };
    update();
    window.addEventListener("hashchange", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return (
    <>
      <strong id="dashEnergyCost">{cost}</strong>
      <span id="dashEnergyMeta">{meta}</span>
      <small id="dashEnergyUnit">{unit}</small>
    </>
  );
}
export default function Dashboard({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const [period, setPeriod] = useState(0),
    [filter, setFilter] = useState(0);
  const set = sets[period];
  const open = (view: string, id?: string) =>
    navigate("/" + view + (id ? "?id=" + id : ""));
  return (
    <div className="ws-module p-dashboard">
      <header className="p-page-heading">
        <div>
          <div className="p-eyebrow">
            <span className="p-pulse" /> PULSO DA OPERAÇÃO
          </div>
          <h1>
            Visão geral da operação<span className="p-title-dot">.</span>
          </h1>
          <p>Todos os sinais. Uma visão para decidir.</p>
        </div>
        <button
          id="periodBtn"
          className="p-period"
          onClick={() => setPeriod((period + 1) % 3)}
        >
          <CalendarDays size={16} />
          {set.name}
          <ChevronDown size={14} />
        </button>
      </header>
      <section className="p-metric-band" aria-label="Indicadores da operação">
        <button data-detail="maquinas" onClick={() => open("maquinas")}>
          <span>
            Máquinas em operação <WashingMachine size={17} />
          </span>
          <strong>
            08<small>/ 10</small>
          </strong>
          <em>
            <i className="p-dot" /> 80% da capacidade disponível
          </em>
        </button>
        <button data-detail="consumo" onClick={() => open("consumo")}>
          <span>
            Consumo no período <Droplets size={17} />
          </span>
          <strong>
            {set.total}
            <small>L</small>
          </strong>
          <em className="p-improvement">
            <ArrowDownRight size={15} />
            {set.delta}% <b>vs. média</b>
          </em>
        </button>
        <button data-detail="maquinas" onClick={() => open("maquinas")}>
          <span>
            Eficiência operacional <Activity size={17} />
          </span>
          <strong>
            92<small>%</small>
          </strong>
          <em className="p-improvement">
            <ArrowUpRight size={15} />3 p.p. <b>vs. período anterior</b>
          </em>
        </button>
        <button data-detail="alertas" onClick={() => open("alertas")}>
          <span>
            Ocorrências ativas <TriangleAlert size={17} />
          </span>
          <strong>
            02<small className="p-alert-count">Acompanhar</small>
          </strong>
          <em>
            1 crítica <span className="p-separator">/</span> 1 atenção
          </em>
        </button>
      </section>
      <div className="p-dashboard-primary">
        <section className="p-surface p-consumption">
          <div className="p-section-heading">
            <div>
              <div className="p-eyebrow">ANÁLISE DE CONSUMO</div>
              <h2>Uma operação mais eficiente</h2>
            </div>
            <button
              className="p-icon-link"
              aria-label="Abrir análise de consumo"
              onClick={() => open("consumo")}
            >
              <MoveUpRight size={19} />
            </button>
          </div>
          <div className="p-chart-summary">
            <strong>
              {set.total}
              <small> litros</small>
            </strong>
            <span className="p-change">
              <ArrowDownRight size={14} />
              {set.delta}% abaixo da média
            </span>
          </div>
          <AreaChart values={set.values} labels={set.labels} />
          <div className="p-chart-footer">
            <span>
              <i />
              Consumo do período
            </span>
            <span>
              <i className="p-dashed" />
              Referência comparativa ilustrativa
            </span>
            <button onClick={() => open("relatorios")}>
              Ver relatório <ArrowRight size={14} />
            </button>
          </div>
        </section>
        <aside className="p-insight">
          <div className="p-eyebrow">
            <Zap size={15} /> INTELIGÊNCIA OPERACIONAL
          </div>
          <h2>
            Menos consumo.
            <br />
            Mais controle.
          </h2>
          <p>
            O consumo de amaciante caiu 8% nos últimos 7 dias. Explore o que
            está por trás dessa variação ilustrativa.
          </p>
          <div className="p-efficiency-ring">
            <svg viewBox="0 0 150 150" aria-hidden="true">
              <circle cx="75" cy="75" r="62" className="p-ring-track" />
              <circle
                cx="75"
                cy="75"
                r="62"
                className="p-ring-value"
                pathLength="100"
                strokeDasharray="92 100"
              />
            </svg>
            <div>
              <strong>
                92<span>%</span>
              </strong>
              <small>eficiência estimada</small>
            </div>
          </div>
          <div className="p-insight-footer">
            <span>
              <i />
              Dentro da meta ilustrativa
            </span>
            <button onClick={() => open("consumo")}>
              Explorar indicadores <ArrowUpRight size={16} />
            </button>
          </div>
        </aside>
      </div>
      <section className="p-activity-strip" aria-label="Atividade de hoje">
        <span>ATIVIDADE DE HOJE</span>
        <div>
          <strong>127</strong>
          <small>ciclos realizados</small>
        </div>
        <div>
          <strong>58,4 L</strong>
          <small>consumo estimado</small>
        </div>
        <div>
          <strong>−12%</strong>
          <small>vs. média ilustrativa</small>
        </div>
        <button className="p-text-link" onClick={() => open("relatorios")}>
          Abrir relatório <ArrowUpRight size={14} />
        </button>
      </section>
      <section className="p-reservoir-section">
        <div className="p-section-heading">
          <div>
            <div className="p-eyebrow">ESTOQUE INTELIGENTE</div>
            <h2>O próximo ciclo começa aqui</h2>
          </div>
          <button className="p-text-link" onClick={() => open("reservatorios")}>
            Ver reservatórios <ArrowRight size={15} />
          </button>
        </div>
        <div className="p-vessels">
          {tanks.map((t) => (
            <button
              className={
                "p-vessel " + (t.level < 45 ? "p-vessel-attention" : "")
              }
              data-detail="reservatorios"
              data-id={t.id}
              key={t.id}
              onClick={() => open("reservatorios", t.id)}
            >
              <div className="p-vessel-data">
                <span className="p-vessel-name">{t.name}</span>
                <strong>
                  {t.level}
                  <small>%</small>
                </strong>
                <span>
                  {t.liters} L <b>/ 20 L</b>
                </span>
                <em>
                  {t.level < 45 ? "Planejar reposição" : "Nível adequado"}
                </em>
                <small>
                  Autonomia estimada <b>{t.days} dias</b>
                </small>
              </div>
              <div className="p-vessel-glass" aria-hidden="true">
                <div className="p-vessel-ticks" />
                <div
                  className="p-vessel-liquid"
                  style={{ height: t.level + "%" }}
                >
                  <i />
                  <i />
                </div>
                <div className="p-vessel-limit" />
              </div>
              <ChevronRight className="p-vessel-arrow" size={15} />
            </button>
          ))}
        </div>
      </section>
      <div className="p-bottom-grid">
        <section className="p-surface p-machine-fleet">
          <div className="p-section-heading">
            <div>
              <div className="p-eyebrow">PARQUE DE EQUIPAMENTOS</div>
              <h2>Cada máquina, um sinal</h2>
            </div>
            <button
              className="p-filter"
              onClick={() => setFilter((filter + 1) % 3)}
            >
              {["Todas", "Em operação", "Em manutenção"][filter]}
              <ChevronDown size={14} />
            </button>
          </div>
          <div className="p-machine-grid">
            {machines
              .filter(
                (m) =>
                  filter === 0 ||
                  (filter === 1 ? m.pct > 0 : m.state === "Manutenção"),
              )
              .map((m) => (
                <button
                  data-detail="maquinas"
                  data-id={m.id}
                  className={
                    "p-machine " +
                    (m.state === "Manutenção" ? "p-machine-warning" : "")
                  }
                  key={m.id}
                  onClick={() => open("maquinas", m.id)}
                >
                  <div className="p-machine-top">
                    <span>{m.id}</span>
                    <i
                      className={"p-dot " + (m.pct === 0 ? "p-dot-idle" : "")}
                    />
                  </div>
                  <div className="p-machine-illustration" aria-hidden="true">
                    <div className="p-machine-controls">
                      <i />
                      <span />
                      <i />
                    </div>
                    <div className="p-machine-drum">
                      <span className={m.pct > 0 ? "p-spinning" : ""} />
                    </div>
                  </div>
                  <strong>{m.name}</strong>
                  <small>{m.state}</small>
                  <div className="p-machine-progress">
                    <i style={{ width: Math.max(3, m.pct) + "%" }} />
                  </div>
                  <div className="p-machine-meta">
                    <span>{m.pct > 0 ? m.pct + "%" : m.program}</span>
                    <b>{m.time}</b>
                  </div>
                </button>
              ))}
          </div>
          <button
            className="p-text-link p-fleet-link"
            onClick={() => open("maquinas")}
          >
            Explorar equipamentos <ArrowRight size={15} />
          </button>
        </section>
        <section className="p-surface p-priority">
          <div className="p-section-heading">
            <div>
              <div className="p-eyebrow">EXIGE SUA ATENÇÃO</div>
              <h2>Prioridades</h2>
            </div>
            <span className="p-number-badge">02</span>
          </div>
          <button
            className="p-priority-row"
            onClick={() => open("reservatorios", "amaciante")}
          >
            <span className="p-alert-icon">
              <Droplets size={19} />
            </span>
            <div>
              <span className="p-critical">REPOSIÇÃO</span>
              <strong>Amaciante em atenção</strong>
              <small>43% de nível · 5 dias de autonomia</small>
            </div>
            <ArrowUpRight size={15} />
          </button>
          <button
            className="p-priority-row"
            onClick={() => open("maquinas", "M05")}
          >
            <span className="p-alert-icon p-alert-muted">
              <WashingMachine size={19} />
            </span>
            <div>
              <span className="p-critical">MANUTENÇÃO</span>
              <strong>Secadora 01 indisponível</strong>
              <small>Acompanhar retorno à operação</small>
            </div>
            <ArrowUpRight size={15} />
          </button>
          <button className="p-text-link" onClick={() => open("alertas")}>
            Central de alertas <ArrowRight size={15} />
          </button>
        </section>
      </div>
      <section className="p-energy-strip">
        <div className="p-energy-symbol">
          <Zap size={24} />
        </div>
        <div>
          <span className="p-eyebrow">ENERGIA · CUSTO ESTIMADO</span>
          <EnergySummary />
        </div>
        <div className="p-energy-context">
          <strong>
            1.248 <span>kWh</span>
          </strong>
          <small>Base demonstrativa do cálculo</small>
        </div>
        <button className="p-text-link" onClick={() => open("energia")}>
          Composição da tarifa <ArrowUpRight size={16} />
        </button>
      </section>
    </div>
  );
}
