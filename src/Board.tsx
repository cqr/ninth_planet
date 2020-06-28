import React, { FC, useState, useCallback } from 'react';
import { BoardProps, Ctx } from 'boardgame.io';
import { GameState, ICard, ITeammate, isValidPlay, CommsState, MissionConfig, ITask, Token, TeammateTask } from './Game';

const MAX_HAND_SIZE = 15;

function Card(props: { card: ICard, played?: boolean, onClick?: any, validPlay: boolean } | { played: true }) {
  if (props.played) {
    return <div className="card played" />
  } else {
    const card = props.card;
    return <div className={`card suit-${card.suit} ${props.validPlay ? 'valid' : 'invalid'}`} onClick={props.onClick}><div className="value">{card.value}</div></div>
  }
}

function cardKey(card: ICard) {
  return `${card.suit}-${card.value}`;
}

export const Board: FC<BoardProps<GameState>> = (props: BoardProps<GameState>) => {
  const { captain, team, trick } = props.G;
  const { activePlayers } = props.ctx;

  const playerID: string | undefined = props.playerID || props.ctx.currentPlayer;
  const me = playerID ? props.G.players[playerID] : undefined;
  const hand = me ? pad(me.hand, MAX_HAND_SIZE) : undefined;

  const { initiateTransmission, pass, playCard, setName, defineMission, selectTask } = props.moves;
  const teamIds = Object.keys(team);
  const myPosition = typeof playerID !== 'undefined' ? teamIds.indexOf(playerID) : undefined;
  const orderedTeamIds = typeof myPosition !== 'undefined' ? teamIds.slice(myPosition + 1).concat(teamIds.slice(0, myPosition)) : teamIds;
  const phase: string | undefined = activePlayers ? activePlayers[playerID] : props.ctx.currentPlayer === playerID ? props.ctx.phase : undefined;
  const transmitting = activePlayers?.[playerID] === 'transmit';
  return (
    <div className="board">
      <div className="team">{orderedTeamIds.map(teammateId => (<Teammate phase={props.ctx.activePlayers?.[teammateId]} key={teammateId} isCaptain={captain === teammateId} isLeadPlayer={trick.leadPlayer === teammateId} teammate={team[teammateId]} playerId={teammateId} />))}</div>
      <div className="active">
        <Phase phase={phase} G={props.G} ctx={props.ctx} onTransmit={(data: any) => initiateTransmission(data)} onSilence={() => pass()} onJoin={(name: string) => setName(name)} onDefineMission={(config: MissionConfig) => defineMission(config)} onTaskSelected={selectTask} />
      </div>
      <div className="statusMesage">{statusMessage(playerID, props.ctx.currentPlayer, props.G.team[props.ctx.currentPlayer].playerName, phase, activePlayers)}</div>
      {me && hand ? <div className="hand">{hand.map((card, index) => card ? <Card key={cardKey(card)} card={card} onClick={() => playCard(card)} validPlay={isValidPlay(me.hand, trick.cards, card, transmitting)} /> : <Card played={true} key={index} />)} </div> : ''}
    </div>
  );
}

function statusMessage(playerID: string, currentPlayerID: string, currentPlayerName?: string, phase?: string, activePlayers: { [key: string]: string } | null = null): string {
  if (phase === 'selectTasks' && playerID === currentPlayerID) {
    return 'Select a task';
  } else if (phase === 'selectTasks') {
    return `${currentPlayerName} is selecting a task`;
  } else if (phase === 'join') {
    return 'Enter a name to join the mission';
  } else if (phase === '') {
  }
  return 'xxx';
}

const Phase: FC<{ G: GameState, ctx: Ctx, phase?: string, onTransmit: any, onSilence: any, onJoin: any, onDefineMission: any, onTaskSelected: any }> = (props) => {
  const [name, setName] = useState("");
  const [taskCount, setTaskCount] = useState(0);
  const [tokenMap, setTokenMap] = useState({});
  const onNameChange = useCallback(event => {
    setName(event.target.value);
  }, [setName])
  const { onJoin, onDefineMission } = props;
  const onSubmitJoin = useCallback(event => {
    event.preventDefault();
    onJoin(name);
  }, [onJoin, name]);
  const onTaskCountChange = useCallback(e => {
    setTaskCount(parseInt(e.target.value, 10));
  }, [setTaskCount]);
  const onSubmitDefine = useCallback(event => {
    event.preventDefault();
    onDefineMission({ tasks: taskCount, tokens: tokenMap });
  }, [onDefineMission, taskCount, tokenMap]);

  if (props.phase === 'wait' || props.phase === 'transmit') {
    return <TransmissionUI passed={false} onTransmit={props.onTransmit} onSilence={props.onSilence} transmitting={props.phase === 'transmit'} />
  } else if (props.phase === 'join') {
    onJoin('Chrisxx');
    return <form onSubmit={onSubmitJoin}><input type="text" onChange={onNameChange} value={name} /><button type="submit">join</button></form>;
  } else if (props.phase === 'defineMission') {
    return <form onSubmit={onSubmitDefine}><label htmlFor="taskCount">Number of Tasks:</label><input type="number" value={taskCount} onChange={onTaskCountChange} /><label>Tokens</label><button type="submit">Start Mission</button></form>;
  } else if (props.G.tasks.length) {
    return <TaskSelector tasks={props.G.tasks} onTaskSelected={props.onTaskSelected} />
  }
  return <h1>OK</h1>;
};

const TaskSelector: FC<{ tasks: ITask[], onTaskSelected: any }> = (props) => {
  return <ul className="tasks">{props.tasks.map((task, i) => <li key={JSON.stringify(task.card)} onClick={() => props.onTaskSelected(i)}><Card card={task.card} validPlay={true} /></li>)}</ul>;
}

function TransmissionUI(props: { passed: boolean, onTransmit: any, onSilence: any, transmitting: boolean }) {
  return (
    <>
      <h1>Scanning for transmissions...</h1>
      {props.passed ? <p>Waiting for other players.</p> : props.transmitting ? <p>Select a card to transmit</p> : <><button onClick={props.onTransmit}>Transmit</button><button onClick={props.onSilence}>Radio Silence</button></>}
    </>
  );
}

function pad<T>(hand: T[], size: number): (T | void)[] {
  const returnValue = new Array(size).fill(undefined);
  const floatStart = (size - hand.length) / 2;
  const start = Math.round(floatStart);

  if (start <= 0) {
    return hand;
  }

  hand.forEach((value, index) => {
    returnValue[index + start] = value;
  });

  if (floatStart !== start) {
    returnValue.splice(0, 1);
  }

  return returnValue;
}

function CardBack() {
  return <div className="card suit-back"><div className="value"></div></div>
}

function Teammate(props: { teammate: ITeammate, playerId: string, isCaptain: boolean, isLeadPlayer: boolean, phase?: string }) {
  return (
    <div className={`teammate phase-${props.phase || 'none'}`}>
      <div className="tmhand">{new Array(props.teammate.handSize).fill(undefined).map((_, index) => <CardBack key={index} />)}</div>
      <CommsUI teammate={props.teammate} />
      <Tasks tasks={props.teammate.tasks} />
      <h2>{props.isCaptain ? <><span role="img" aria-label="Captain" title="Captain"><img alt="Captain" src="/captain.svg" height="14"></img></span>{` `}</> : ''}{props.teammate.playerName || `Waiting for Seat ${1 + parseInt(props.playerId)} ...`}</h2>
    </div>
  );
}

const CommsUI: FC<{ teammate: ITeammate }> = (props) => {
  const { commsTokenState, commsTokenCard } = props.teammate;
  if (commsTokenState === CommsState.Spent) {
    return <div className="comms spent"></div>;
  } else if (commsTokenState === CommsState.Unused) {
    return <div className="comms unused"></div>;
  }
  return <div className="comms"><CommsTokenCard card={commsTokenCard} state={commsTokenState!} /></div>
}

const Tasks: FC<{ tasks: TeammateTask[] }> = (props) => {
  const { tasks } = props;
  if (props.tasks.length) {
    return <div className="tasks">{tasks.map(task => <Task card={task.card} complete={task.complete} token={task.token} />)}</div>;
  }
  return <div className="tasks">None</div>;
}

const Task: FC<{ card: ICard, complete: boolean, token: Token }> = (props) => {
  const { card } = props
  return <Card card={card} validPlay={true} />;
}

function Trick(props: { trick: { cards: ICard[], leadPlayer: string }, leadPlayerName?: string }) {
  if (props.trick.cards && props.trick.cards.length) {
    return <>{props.trick.cards.map(card => <Card key={cardKey(card)} card={card} validPlay={true} />)}</>;
  } else {
    return <h1>{props.leadPlayerName || `Player ${parseInt(props.trick.leadPlayer, 10) + 1}`} Leads</h1>
  }
}

const CommsTokenCard: FC<{ state: CommsState, card?: ICard }> = (props) => {
  const { card, state } = props;
  return <><Card card={card!} validPlay={true} /><div className={`commsToken token-${state}`} /></>;
}
