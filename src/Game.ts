import { Game, Ctx } from 'boardgame.io';
import { INVALID_MOVE, PlayerView } from 'boardgame.io/core';

export enum Suit {
  Rocket,
  Pink,
  Blue,
  Green,
  Orange
}

export enum CommsState {
  Unused,
  InPlayHigh,
  InPlayLow,
  InPlayOnly,
  Spent
}

export interface ICard {
  value: number;
  suit: Suit;
}

export enum Token {
  First,
  Second,
  Third,
  Fourth,
  Fifth,
  Last,
  Priority1,
  Priority2,
  Priority3,
  Priority4
}

const SortedTokens: Token[] = [
  Token.First, Token.Second, Token.Third, Token.Fourth,
  Token.Fifth, Token.Last, Token.Priority1, Token.Priority2,
  Token.Priority3, Token.Priority4
];

export interface ITask {
  card: ICard;
  token: Token;
}

export interface TeammateTask extends ITask {
  complete: boolean
}

export interface PlayerState {
  hand: ICard[];
  name?: string;
  commsTokenState: CommsState;
  commsTokenCard?: ICard
}

export interface ITeammate {
  commsTokenState?: CommsState;
  commsTokenCard?: ICard;
  tasks: TeammateTask[];
  handSize: number;
  playerName?: string;
}

export interface ITrick {
  winner: string;
  cards: ICard[];
}

export interface GameState {
  captain: string;
  secret: {
    tricks: ITrick[]
  };
  players: {
    [playerId: string]: PlayerState
  };
  team: {
    [playerId: string]: ITeammate
  };
  tasks: ITask[];
  lastTrick?: ITrick;
  trick: {
    leadPlayer: string;
    cards: ICard[];
  };
}

export interface MissionConfig {
  tasks: number;
  tokens: {[key in Token]: boolean };
}

const Deck: ICard[] = [Suit.Pink, Suit.Blue, Suit.Green, Suit.Orange].flatMap((suit) => {
  return new Array(9).fill(undefined).map((_, index) => ({suit, value: index + 1}));
}).concat(new Array(4).fill('undefined').map((_, index) => ({suit: Suit.Rocket, value: index + 1 })));

function sortHand(hand: ICard[]): ICard[] {
  return hand.sort((a, b) => {
    if (a.suit < b.suit) {
      return -1;
    } else if (b.suit < a.suit) {
      return 1;
    } else {
      return a.value - b.value;
    }
  });
}

function isCaptain(playerState: PlayerState) {
  return !!playerState.hand.find((card) => card.suit === Suit.Rocket && card.value === 4);
}

export const NinthPlanet: Game<GameState> = {

  name: 'NinthPlanet',

  setup: (ctx, setupData):GameState => {
    const deck = ctx.random!.Shuffle(Deck);

    const hands = Array(ctx.numPlayers).fill(undefined).map<PlayerState>((_, playerNumber) => {
      const hand = sortHand(deck.filter((_, ci) => ci % ctx.numPlayers === playerNumber));
      return { hand, commsTokenState: CommsState.Unused, tasks: [] };
    });
    const players = hands.reduce<{[playerId: string]: PlayerState}>((c, n, i) => { c[i.toString()] = n; return c }, {});
    const captain = hands.findIndex(isCaptain).toString();
    const val: GameState = {
      captain,
      players,
      trick: {
        cards: [],
        leadPlayer: captain
      },
      team: deriveTeamState(players),
      tasks: [],
      secret: {
        tricks: []
      }
    };
    return val;
  },

  playerView: PlayerView.STRIP_SECRETS,

  phases: {
    join: {
      start: true,
      onBegin(_, ctx) { ctx.events?.setActivePlayers?.({all: 'join' })},
      endIf: G => {
        return Object.values(G.team).filter(teammate => !teammate.playerName).length === 0;
      },
      next: 'defineMission'
    },
    defineMission: {
      onBegin(_, ctx) { ctx.events?.setActivePlayers?.({all: 'defineMission'})},
      next: 'selectTasks'
    },
    selectTasks: {
      endIf: G => G.tasks.length === 0,
      moves: {
        selectTask(G, ctx, taskIndex:number) {
          const playerID = ctx.playerID || ctx.currentPlayer;
          const task = G.tasks[taskIndex];
          const tasks = G.tasks.filter((_, i) => i !== taskIndex);
          const teammate = derivePlayerTeamState(G.players[playerID], G.team[playerID]);
          ctx.events?.endTurn?.();
          return { ...G, tasks, team: { ...G.team, [playerID]: {...teammate, tasks: teammate.tasks.concat({...task, complete: false})}}};
        }
      },
      next: 'play'
    },
    play: {
      onBegin(G, ctx) {
        const stages = Object.keys(G.players).filter(playerID => G.team[playerID].commsTokenState === CommsState.Unused)
        .reduce<{[x:string]:'wait'}>((c, pid) => {
          c[pid] = 'wait';
          return c;
        }, {});
        ctx.events?.setActivePlayers?.({value: stages, revert: true});
      },
      endIf: (G, ctx) => G.trick.cards.length >= ctx.numPlayers,
      onEnd(G, ctx){
        const leadSuit = G.trick.cards[0].suit;
        const highCard = getHighCard(G.trick.cards, leadSuit);
        const highCardIndex = G.trick.cards.findIndex(card => matchCards(highCard, card));
        const winner = ctx.playOrder[highCardIndex];
        const allTaskCards = Object.keys(G.team).flatMap(playerID => G.team[playerID].tasks.map(x => ({...x, playerID})));
        const team = { ...G.team };

        for (const card of G.trick.cards) {
          const task = allTaskCards.find(task => cardCmp(card, task.card) === 0)
          if (task) {
            if (task.playerID === winner) {
              team[winner] = {...team[winner], tasks: team[winner].tasks.map(task => cardCmp(task.card, card) === 0 ? { ...task, complete: true} : task )}
            } else {
              ctx.events?.endGame?.('failed');
            }
          }
        }

        const lastTrick = { winner, cards: G.trick.cards };
        const trick = { leadPlayer: winner, cards: []};
        return { ...G, team, trick, lastTrick, secret: { ...G.secret, tricks: G.secret.tricks.push(lastTrick) } };
      },

      moves: {
        playCard: {
          move: (G:GameState, ctx: Ctx, card: ICard) => {
            const playerID = ctx.playerID || ctx.currentPlayer;
            const activePlayer = G.players[playerID];
      
            const cardIndex = activePlayer.hand.findIndex(handCard => matchCards(handCard, card));
            if (cardIndex === -1) {
              return INVALID_MOVE;
            }

            const trick = G.trick.cards;
            if (!isValidPlay(activePlayer.hand, G.trick.cards, activePlayer.hand[cardIndex])) {
              return INVALID_MOVE;
            }
      
            const trickCards: ICard[] = trick.slice(0).concat(activePlayer.hand[cardIndex]);
            const players = { ...G.players, [playerID]: { ...activePlayer, hand: activePlayer.hand.filter(handCard => !matchCards(handCard, card))}}
            const team = { ...G.team, [playerID]: derivePlayerTeamState(players[playerID], G.team[playerID])};
      
            ctx.events?.endTurn?.();
            return { ...G, trick: {...G.trick, cards: trickCards}, players, team };
          },
          client: false
        }
      },
      next: 'play'
    },
  },

  turn: {
    stages: {
      join: {
        moves: {
          setName: (G, ctx, name) => {
            console.log(ctx);
            const playerID = ctx.playerID || ctx.currentPlayer;
            const me = {...G.players[playerID], name: name};
            ctx.events?.endStage?.();
            return { ...G, players: {...G.players, [playerID]: me}, team: {...G.team, [playerID]: derivePlayerTeamState(me, G.team[playerID])}};
          }
        }
      },
      defineMission: {
        moves: {
          defineMission(G, ctx, config: MissionConfig ) {
            const cards = ctx.random?.Shuffle(Deck.filter(x => x.suit !== Suit.Rocket )).slice(0, config.tasks) || [];
            const tokens = SortedTokens.filter(x => config.tokens[x]);
            const tasks: ITask[] = cards.map((card, i) => ({card, token: tokens[i]}) );
            ctx.events?.endPhase?.('play');
            return { ...G, tasks };
          }
        }
      },
      wait: {
        moves: {
          initiateTransmission(_, ctx) {
            ctx.events!.setStage!('transmit');
          },
          pass(_, ctx) {
            ctx.events?.endStage?.();
          },
        }
      },
      transmit: {
        moves: {
          playCard: {
            move: (G, ctx, card) => {
              const playerID = ctx.playerID || '0';
              const currentPlayer = G.players[playerID];
              if (!isValidPlay(currentPlayer.hand, [], card, true)) {
                return INVALID_MOVE;
              }
              const cardsOfSuit = currentPlayer.hand.filter(x => x.suit === card.suit);
              const commsTokenState = highLowOnly(card, cardsOfSuit);
              const me = {...currentPlayer, commsTokenState, commsTokenCard: card};
              const players = { ...G.players, [playerID]:me};
              ctx.events?.endStage?.();
              return { ...G, players, team: { ...G.team, [playerID]: derivePlayerTeamState(me, G.team[playerID]) } };
            }
          },
          cancel(_, ctx) {
            ctx.events!.setStage!('wait');
          }
        }
      }
    },
    order: {
      first: () => 0,
      next: (G, ctx) => (ctx.playOrderPos + 1) % ctx.numPlayers,
      playOrder: (G, ctx) => {
        const firstPlayer = G.trick.leadPlayer;
        const playerIds = Object.keys(G.players);
        const firstPlayerIndex = playerIds.indexOf(firstPlayer);
        const result = new Array(ctx.numPlayers);
        for (let i = 0; i < ctx.numPlayers; i++) {
          result[i] = playerIds[(firstPlayerIndex + i) % ctx.numPlayers];
        }
        return result;
      }
    }
  }
};

function matchCards(card1:ICard, card2:ICard): boolean {
  return card1.value === card2.value && card1.suit === card2.suit;
}

function getHighCard(cards: ICard[], suit: Suit) {
  const rocketCards = cards.filter(card => card.suit === Suit.Rocket)
  const filteredCards = rocketCards.length ? rocketCards : cards.filter(card => card.suit === suit);
  return filteredCards.sort((a, b) => b.value - a.value)[0];
}

function deriveTeamState(players: {[playerId: string]: PlayerState}, teammates?: {[playerId: string]: ITeammate}): {[teammateId: string]: ITeammate} {
  const team: {[teammateId: string]: ITeammate} = {};
  for (const teammateId of Object.keys(players)) {
    team[teammateId] = derivePlayerTeamState(players[teammateId], teammates?.[teammateId]);
  }
  return team;
}

function derivePlayerTeamState(player: PlayerState, teammate?: ITeammate): ITeammate {
  return {
    commsTokenCard: player.commsTokenCard,
    commsTokenState: player.commsTokenState,
    handSize: player.hand.length,
    playerName: player.name,
    tasks: teammate?.tasks || []
  };
}


export function isValidPlay(hand: ICard[], trick: ICard[], card: ICard, transmitting=false) {
  if (transmitting) {
    if (card.suit === Suit.Rocket) {
      return false;
    }
    const otherCards = hand.filter(x => x.suit === card.suit).sort((a, b) => a.value - b.value);
    return cardCmp(card, otherCards[0]) === 0 || cardCmp(card, otherCards.pop() as ICard) === 0;
  }
  return !trick?.[0] || trick[0].suit === card.suit || !hand.find(x => x.suit === trick[0].suit)
}

function highLowOnly(card: ICard, cardsOfSuit: ICard[]) {
  cardsOfSuit = cardsOfSuit.sort((a, b) => a.value - b.value);
  if (cardsOfSuit.length === 1) {
    return CommsState.InPlayOnly;
  } else if (cardCmp(cardsOfSuit[0], card) === 0) {
    return CommsState.InPlayLow;
  } else {
    return CommsState.InPlayHigh;
  }
}

function cardCmp(card1:ICard, card2:ICard) {
  return (card1.suit * 10 + card1.value) - (card2.suit * 10 + card2.value);
}