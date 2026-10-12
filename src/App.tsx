import React, { useState } from "react";

const Icon = ({ name, size = 20 }: { name: string; size?: number }) => {
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    box: <><path d="m3 7 9-4 9 4-9 4-9-4Z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/></>,
    activity: <><path d="M3 12h4l3-8 4 16 3-8h4"/></>,
    droplets: <><path d="M12 3s6 6.1 6 10a6 6 0 1 1-12 0c0-3.9 6-10 6-10Z"/><path d="M9 15c.5 1.1 1.5 1.8 3 2"/></>,
    bolt: <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z"/>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    settings: <><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="m19.4 15 .1.1a2 2 0 1 1-2.8 2.8l-.1-.1a2 2 0 0 0-3.4 1.4v.3a2 2 0 1 1-4 0v-.2A2 2 0 0 0 5.8 18l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A2 2 0 0 0 1.6 12a2 2 0 1 1 0-4h.2A2 2 0 0 0 3 4.6l-.1-.1A2 2 0 1 1 5.7 1.7l.1.1A2 2 0 0 0 9.2.4V.2a2 2 0 1 1 4 0v.2A2 2 0 0 0 16.6 2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A2 2 0 0 0 20.8 8h.2a2 2 0 1 1 0 4h-.2a2 2 0 0 0-1.4 3Z"/></>,
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    menu: <><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></>,
    x: <><path d="m6 6 12 12"/><path d="m18 6-12 12"/></>,
    chevron: <path d="m6 9 6 6 6-6"/>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/></>,
    wifi: <><path d="M5 12.5a11 11 0 0 1 14 0"/><path d="M8 15.5a6.5 6.5 0 0 1 8 0"/><path d="M11 18.5a2.2 2.2 0 0 1 2 0"/><path d="M2 9a16 16 0 0 1 20 0"/></>,
    shield: <><path d="M12 3 20 6v6c0 5-3.3 8-8 9-4.7-1-8-4-8-9V6l8-3Z"/><path d="m9 12 2 2 4-4"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
};

const Logo = () => (
  <a className="logo" href="#top" aria-label="WashSense">
    <span className="logo-mark">
      <span className="logo-drop"></span>
      <span className="logo-wave w1"></span>
      <span className="logo-wave w2"></span>
    </span>
    <span>Wash<span>Sense</span></span>
  </a>
);

const Dashboard = ({ large = false }: { large?: boolean }) => (
  <div className={`dash-shell ${large ? "dash-large" : ""}`}>
    <div className="dash-top">
      <div className="dash-brand"><span className="mini-logo"></span><b>WashSense</b></div>
      <div className="dash-date">Unidade Principal <span className="online-dot"></span></div>
    </div>
    <div className="dash-body">
      <aside className="dash-side">
        <div className="side-active"><Icon name="grid" size={15}/> Visão geral</div>
        <div><Icon name="activity" size={15}/> Máquinas</div>
        <div><Icon name="droplets" size={15}/> Reservatórios</div>
        <div><Icon name="bolt" size={15}/> Consumo</div>
        <div><Icon name="bell" size={15}/> Alertas <i>2</i></div>
        <div><Icon name="settings" size={15}/> Configurações</div>
      </aside>
      <main className="dash-main">
        <div className="dash-heading">
          <div><span>Visão geral</span><h3>Olá, George.</h3></div>
          <button className="dash-filter">Hoje <Icon name="chevron" size={12}/></button>
        </div>
        <div className="metric-grid">
          <div className="metric"><span>Máquinas online</span><strong>08</strong><em className="up">+2 hoje</em></div>
          <div className="metric"><span>Reservatórios</span><strong>04</strong><em className="cyan">Monitorados</em></div>
          <div className="metric"><span>Consumo hoje</span><strong>128<span>L</span></strong><em className="up">−8,4% vs. ontem</em></div>
          <div className="metric"><span>Alertas ativos</span><strong>02</strong><em className="warn">Atenção necessária</em></div>
        </div>
        <div className="dash-row">
          <div className="panel chart-panel">
            <div className="panel-head"><div><span className="panel-label">CONSUMO</span><b>Consumo de produtos</b></div><span className="panel-period">7 dias</span></div>
            <div className="chart">
              <div className="chart-grid"><span></span><span></span><span></span><span></span></div>
              <div className="bars">{[42,58,49,72,64,78,61,88,67,82,71,94].map((h,i)=><div key={i} className="bar-wrap"><div className="bar" style={{height:`${h}%`}}></div></div>)}</div>
              <div className="axis"><span>22/09</span><span>24/09</span><span>26/09</span><span>28/09</span></div>
            </div>
          </div>
          <div className="panel alert-panel">
            <div className="panel-head"><div><span className="panel-label">ATENÇÃO</span><b>Alertas recentes</b></div><span className="see-all">Ver todos</span></div>
            <div className="alert-row"><span className="alert-icon red"><Icon name="droplets" size={15}/></span><div><b>Detergente</b><small>Nível abaixo de 20%</small></div><strong>Agora</strong></div>
            <div className="alert-row"><span className="alert-icon yellow"><Icon name="activity" size={15}/></span><div><b>Máquina 04</b><small>Sem atividade</small></div><strong>12 min</strong></div>
            <div className="alert-row"><span className="alert-icon blue"><Icon name="settings" size={15}/></span><div><b>Máquina 02</b><small>Manutenção programada</small></div><strong>Amanhã</strong></div>
          </div>
        </div>
        <div className="dash-row lower">
          <div className="panel reservoir-panel">
            <div className="panel-head"><div><span className="panel-label">RESERVATÓRIOS</span><b>Níveis atuais</b></div><span className="see-all">Detalhes</span></div>
            {[
              ["Detergente","82%","246 L","cyan"],["Amaciante","58%","174 L","purple"],["Alvejante","36%","108 L","blue"],["Neutralizante","71%","213 L","green"]
            ].map(([n,p,l,c])=><div className="tank" key={n}><div className="tank-line"><span>{n}</span><b>{p}</b></div><div className="progress"><span className={c} style={{width:p}}></span></div><small>{l} disponíveis</small></div>)}
          </div>
          <div className="panel machines-panel">
            <div className="panel-head"><div><span className="panel-label">MÁQUINAS</span><b>Status operacional</b></div><span className="see-all">Ver máquinas</span></div>
            {["Lavadora 01","Lavadora 02","Secadora 01","Lavadora 03"].map((m,i)=><div className="machine-row" key={m}><span className={`machine-status ${i===3?"idle":"active"}`}></span><div><b>{m}</b><small>{i===3?"Sem atividade":"Em operação"}</small></div><span className="machine-kwh">{i===3?"—":`${(4.2+i*0.7).toFixed(1)} kWh`}</span></div>)}
          </div>
        </div>
      </main>
    </div>
  </div>
);

function App() {
  const [menu, setMenu] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const scroll = (id: string) => {
    setMenu(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div id="top" className="site">
      <header className="header">
        <div className="container nav">
          <Logo />
          <nav className={menu ? "nav-links open" : "nav-links"}>
            <button onClick={()=>scroll("solution")}>Solução</button>
            <button onClick={()=>scroll("how")}>Como funciona</button>
            <button onClick={()=>scroll("features")}>Recursos</button>
            <button onClick={()=>scroll("technology")}>Tecnologia</button>
          </nav>
          <div className="nav-actions">
            <button className="login" onClick={()=>alert("A plataforma será conectada ao login do WashSense.")}>Entrar</button>
            <button className="nav-cta" onClick={()=>scroll("contact")}>Solicitar demonstração <Icon name="arrow" size={16}/></button>
          </div>
          <button className="mobile-menu" onClick={()=>setMenu(!menu)} aria-label="Menu"><Icon name={menu ? "x" : "menu"} size={22}/></button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-grid"></div>
          <div className="glow glow-one"></div><div className="glow glow-two"></div>
          <div className="container hero-inner">
            <div className="hero-copy">
              <div className="eyebrow"><span className="pulse"></span> MONITORAMENTO INTELIGENTE PARA LAVANDERIAS</div>
              <h1>Sua lavanderia,<br/><span>sob controle.</span></h1>
              <p>Transforme dados da sua operação em informação. Monitore máquinas, níveis de produtos, consumo e alertas em um único lugar.</p>
              <div className="hero-buttons">
                <button className="primary-btn" onClick={()=>scroll("solution")}>Conheça a solução <Icon name="arrow" size={17}/></button>
                <button className="secondary-btn" onClick={()=>scroll("contact")}>Solicitar demonstração</button>
              </div>
              <div className="hero-proof"><span><Icon name="check" size={14}/> IoT</span><span><Icon name="check" size={14}/> Monitoramento remoto</span><span><Icon name="check" size={14}/> Dados centralizados</span></div>
            </div>
            <div className="hero-visual">
              <div className="float-tag tag-top"><span className="tag-icon"><Icon name="wifi" size={15}/></span><div><b>Conectado</b><small>Dados recebidos agora</small></div></div>
              <Dashboard />
              <div className="float-tag tag-bottom"><span className="tag-icon green"><Icon name="activity" size={15}/></span><div><b>08 máquinas</b><small>operando normalmente</small></div></div>
            </div>
          </div>
          <div className="hero-bottom-fade"></div>
        </section>

        <section className="trust-strip"><div className="container"><span>VISIBILIDADE</span><i></i><span>CONTROLE</span><i></i><span>OPERAÇÃO</span><i></i><span>DADOS</span><i></i><span>TECNOLOGIA</span></div></section>

        <section id="solution" className="section problem">
          <div className="container">
            <div className="section-intro center">
              <span className="section-kicker">O PROBLEMA</span>
              <h2>Você sabe o que está acontecendo<br/><span>na sua lavanderia?</span></h2>
              <p>Quando informações importantes dependem de verificações manuais, a operação fica mais difícil de acompanhar.</p>
            </div>
            <div className="problem-grid">
              <div className="problem-card"><span className="big-num">01</span><div className="problem-icon"><Icon name="eye" size={23}/></div><h3>Falta de visibilidade</h3><p>Informações da operação espalhadas e difíceis de acompanhar de forma centralizada.</p></div>
              <div className="problem-card featured"><span className="big-num">02</span><div className="problem-icon"><Icon name="activity" size={23}/></div><h3>Verificações manuais</h3><p>Dependência de conferências presenciais para saber o estado dos equipamentos e produtos.</p></div>
              <div className="problem-card"><span className="big-num">03</span><div className="problem-icon"><Icon name="droplets" size={23}/></div><h3>Consumo difícil de acompanhar</h3><p>Sem histórico organizado, entender padrões de consumo fica mais trabalhoso.</p></div>
            </div>
          </div>
        </section>

        <section id="how" className="section flow-section flow-pro">
          <div className="flow-pro-glow flow-pro-glow-a"></div>
          <div className="flow-pro-glow flow-pro-glow-b"></div>
          <div className="container">
            <div className="flow-pro-head">
              <div>
                <div className="section-kicker"><span className="kicker-dot"></span> COMO FUNCIONA</div>
                <h2>Do sensor ao seu painel.<br/><span>Sem complicar.</span></h2>
              </div>
              <div className="flow-pro-intro">
                <span className="flow-pro-badge"><Icon name="shield" size={13}/> ARQUITETURA SEGURA</span>
                <p>O WashSense transforma sinais da operação em informação clara, organizada e pronta para tomada de decisão.</p>
              </div>
            </div>

            <div className="flow-pro-track">
              <div className="flow-pro-line"><span></span><i></i><b></b></div>
              {[
                ["01","Sensores","Coleta","activity","Capturam níveis, estados e dados da operação."],
                ["02","Conectividade","Transmissão","wifi","Enviam as informações com segurança."],
                ["03","Cloud","Processamento","database","Organiza os dados e gera indicadores."],
                ["04","WashSense","Monitoramento","grid","Você acompanha tudo em um só lugar."]
              ].map(([n,t,s,ic,d],i)=><div className={`flow-pro-step step-${i+1}`} key={n}>
                <div className="flow-pro-number">{n}</div>
                <div className="flow-pro-icon"><span></span><Icon name={ic} size={25}/></div>
                <div className="flow-pro-copy"><span>{s}</span><h3>{t}</h3><p>{d}</p></div>
              </div>)}
            </div>

            <div className="flow-pro-footer">
              <div><Icon name="wifi" size={15}/><span>Dados em tempo real</span></div>
              <div><Icon name="shield" size={15}/><span>Comunicação segura</span></div>
              <div><Icon name="activity" size={15}/><span>Arquitetura preparada para crescer</span></div>
            </div>
          </div>
        </section>

        <section id="features" className="section features-section">
          <div className="container">
            <div className="section-intro">
              <span className="section-kicker">MONITORAMENTO</span>
              <h2>Tudo o que importa,<br/><span>em um só lugar.</span></h2>
              <p>Uma visão centralizada dos principais indicadores da sua operação.</p>
            </div>
            <div className="feature-mosaic">
              <div className="feature-card reservoir-feature"><div className="feature-top"><span className="feature-icon"><Icon name="droplets" size={21}/></span><span className="mini-label">NÍVEIS</span></div><h3>Reservatórios</h3><p>Visualize os níveis dos produtos e acompanhe a disponibilidade.</p><div className="tanks-mini">{[["Detergente","82%","cyan"],["Amaciante","58%","purple"],["Alvejante","36%","blue"]].map(([n,p,c])=><div className="mini-tank" key={n}><span>{n}</span><div><i className={c} style={{width:p}}></i></div><b>{p}</b></div>)}</div></div>
              <div className="feature-card machine-feature"><div className="feature-top"><span className="feature-icon"><Icon name="activity" size={21}/></span><span className="mini-label">EQUIPAMENTOS</span></div><h3>Máquinas</h3><p>Tenha visibilidade do estado operacional dos equipamentos.</p><div className="machine-orbit"><div className="orbit-ring"></div><div className="machine-center"><Icon name="activity" size={27}/><small>08</small><b>online</b></div><span className="orbit-dot d1"></span><span className="orbit-dot d2"></span><span className="orbit-dot d3"></span></div></div>
              <div className="feature-card consumption-feature"><div className="feature-top"><span className="feature-icon"><Icon name="bolt" size={21}/></span><span className="mini-label">INDICADORES</span></div><h3>Consumo</h3><p>Acompanhe tendências e histórico de consumo.</p><div className="sparkline"><svg viewBox="0 0 300 90" preserveAspectRatio="none"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#16c9ff" stopOpacity=".28"/><stop offset="1" stopColor="#16c9ff" stopOpacity="0"/></linearGradient></defs><path d="M0,70 C25,62 30,38 55,51 S85,75 110,45 S145,28 165,43 S200,64 220,35 S255,20 300,28 L300,90 L0,90Z" fill="url(#area)"/><path d="M0,70 C25,62 30,38 55,51 S85,75 110,45 S145,28 165,43 S200,64 220,35 S255,20 300,28" fill="none" stroke="#19d3ff" strokeWidth="3"/></svg></div></div>
              <div className="feature-card small-feature"><span className="feature-icon"><Icon name="bell" size={21}/></span><h3>Alertas</h3><p>Identifique situações que precisam de atenção.</p><div className="alert-pills"><span className="red-pill">● Nível crítico</span><span className="yellow-pill">● Sem atividade</span></div></div>
              <div className="feature-card small-feature"><span className="feature-icon"><Icon name="settings" size={21}/></span><h3>Manutenção</h3><p>Organize informações de manutenção e programação.</p><div className="maint-line"><span>Próxima manutenção</span><b>02 OUT</b></div></div>
              <div className="feature-card small-feature"><span className="feature-icon"><Icon name="bolt" size={21}/></span><h3>Energia</h3><p>Tenha visibilidade sobre indicadores energéticos.</p><div className="energy-value">24,8 <small>kWh</small></div></div>
            </div>
          </div>
        </section>

        <section className="section dashboard-section">
          <div className="container">
            <div className="dashboard-copy"><span className="section-kicker">PLATAFORMA</span><h2>Uma visão completa<br/><span>da sua operação.</span></h2><p>Informações importantes reunidas em um único dashboard, com uma interface pensada para facilitar o acompanhamento diário.</p><div className="copy-points"><span><Icon name="check" size={14}/> Visão geral da unidade</span><span><Icon name="check" size={14}/> Indicadores operacionais</span><span><Icon name="check" size={14}/> Alertas e status</span></div></div>
            <div className="dashboard-large-wrap"><Dashboard large /></div>
          </div>
        </section>

        <section className="section retrofit">
          <div className="container retrofit-grid">
            <div><span className="section-kicker">RETROFIT</span><h2>Inteligência sem<br/><span>reinventar sua operação.</span></h2><p>O WashSense foi pensado para adicionar monitoramento à infraestrutura existente, sem interferir no funcionamento original dos equipamentos.</p><div className="retrofit-list"><span><Icon name="check" size={15}/> Instalação externa</span><span><Icon name="check" size={15}/> Dados centralizados</span><span><Icon name="check" size={15}/> Arquitetura modular</span></div></div>
            <div className="retrofit-visual"><div className="machine-box"><div className="machine-screen"></div><div className="machine-door"></div><span className="machine-label">EQUIPAMENTO EXISTENTE</span></div><div className="sensor-node"><div className="sensor-pulse"></div><Icon name="wifi" size={18}/><span>SENSOR</span></div><div className="connect-path"></div><div className="wash-node"><span className="mini-logo"></span><b>WashSense</b><small>MONITORAMENTO</small></div></div>
          </div>
        </section>

        <section id="technology" className="section tech-section">
          <div className="container">
            <div className="section-intro center"><span className="section-kicker">TECNOLOGIA</span><h2>Da coleta de dados<br/><span>ao seu dashboard.</span></h2><p>Uma arquitetura pensada para conectar o mundo físico ao software.</p></div>
            <div className="tech-flow">
              {[
                ["01","SENSORES","Coleta","activity"],["02","DISPOSITIVOS","Conectividade","wifi"],["03","MQTT","Transporte","database"],["04","CLOUD","Processamento","shield"],["05","WASHSENSE","Plataforma","grid"]
              ].map(([n,t,s,ic],i)=><React.Fragment key={n}><div className="tech-node"><small>{n}</small><div className="tech-icon"><Icon name={ic} size={20}/></div><b>{t}</b><span>{s}</span></div>{i<4&&<div className="tech-arrow"><Icon name="arrow" size={16}/></div>}</React.Fragment>)}
            </div>
          </div>
        </section>

        <section className="section cta-section">
          <div className="cta-grid"></div><div className="container cta-inner"><span className="section-kicker">WASHSENSE</span><h2>Tenha sua lavanderia<br/><span>sob controle.</span></h2><p>Transforme os dados da sua operação em informação.</p><button className="primary-btn" onClick={()=>scroll("contact")}>Solicitar demonstração <Icon name="arrow" size={17}/></button></div>
        </section>

        <section id="contact" className="section contact-section">
          <div className="container contact-grid">
            <div><span className="section-kicker">CONTATO</span><h2>Vamos conversar<br/><span>sobre sua operação.</span></h2><p>Conte um pouco sobre sua lavanderia e entraremos em contato para apresentar o WashSense.</p><div className="contact-note"><span><Icon name="shield" size={19}/></span><div><b>Seus dados estão seguros.</b><small>Usaremos suas informações apenas para entrar em contato sobre a demonstração.</small></div></div></div>
            <form className="contact-form" onSubmit={(e)=>{e.preventDefault();setSubmitted(true)}}>{submitted?<div className="success"><div className="success-icon"><Icon name="check" size={30}/></div><h3>Mensagem recebida.</h3><p>Obrigado pelo interesse no WashSense. Esta demonstração está em modo de protótipo.</p><button type="button" className="secondary-btn" onClick={()=>setSubmitted(false)}>Enviar outra mensagem</button></div>:<><div className="form-row"><label>Nome<input required placeholder="Seu nome"/></label><label>Empresa<input placeholder="Nome da empresa"/></label></div><div className="form-row"><label>E-mail<input required type="email" placeholder="voce@empresa.com"/></label><label>Telefone<input placeholder="(00) 00000-0000"/></label></div><label>Quantidade de unidades<input placeholder="Ex.: 1, 3, 10..."/></label><label>Mensagem<textarea rows={4} placeholder="Conte brevemente sobre sua operação"></textarea></label><button className="primary-btn full" type="submit">Solicitar demonstração <Icon name="arrow" size={17}/></button></>}</form>
          </div>
        </section>
      </main>

      <footer className="footer"><div className="container footer-top"><div><Logo /><p>Sua lavanderia, sob controle.</p></div><div className="footer-links"><div><b>Produto</b><button onClick={()=>scroll("solution")}>Solução</button><button onClick={()=>scroll("features")}>Recursos</button><button onClick={()=>scroll("technology")}>Tecnologia</button></div><div><b>Empresa</b><button onClick={()=>scroll("how")}>Como funciona</button><button onClick={()=>scroll("contact")}>Contato</button><button onClick={()=>alert("A plataforma será conectada ao login do WashSense.")}>Acessar plataforma</button></div></div></div><div className="container footer-bottom"><span>© 2026 WashSense. Todos os direitos reservados.</span><span>Monitoramento inteligente para lavanderias.</span></div></footer>
    </div>
  );
}

export default App;
