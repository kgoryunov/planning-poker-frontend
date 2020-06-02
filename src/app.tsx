import AppBar from '@material-ui/core/AppBar';
import Backdrop from '@material-ui/core/Backdrop';
import Button from '@material-ui/core/Button';
import ButtonGroup from '@material-ui/core/ButtonGroup';
import CircularProgress from '@material-ui/core/CircularProgress';
import CssBaseline from '@material-ui/core/CssBaseline';
import Paper from '@material-ui/core/Paper';

import { makeStyles } from '@material-ui/core/styles';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import TextField from '@material-ui/core/TextField';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import Alert from '@material-ui/lab/Alert';

import React, { useEffect, useRef, useState } from 'react';
import socketIo from 'socket.io-client';

const useStyles = makeStyles((theme) => ({
  appBar: {
    position: 'relative',
  },
  layout: {
    width: 'auto',
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    [theme.breakpoints.up(600 + theme.spacing(2) * 2)]: {
      width: 600,
      marginLeft: 'auto',
      marginRight: 'auto',
    },
  },
  paper: {
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(3),
    padding: theme.spacing(2),
    [theme.breakpoints.up(600 + theme.spacing(3) * 2)]: {
      marginTop: theme.spacing(6),
      marginBottom: theme.spacing(6),
      padding: theme.spacing(3),
    },
  },
  stepper: {
    padding: theme.spacing(3, 0, 5),
  },
  buttons: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  button: {
    marginTop: theme.spacing(2),
    marginRight: theme.spacing(2),
  },
  voteButtonsGroup: {
    marginTop: theme.spacing(2),
  },
  votesTable: {
    marginTop: theme.spacing(2),
  },
  backdrop: {
    zIndex: theme.zIndex.drawer + 1,
    color: '#fff',
  },
  blinkTransition: {
    transition: 'background 0.2s ease-in',
    backgroundColor: 'inherit',
  },
  blinkGreen: {
    transition: 'none',
    backgroundColor: '#00ff00',
  },
}));

interface Player {
  id: string;
  name: string;
  vote?: number;
  votedAt?: number;
}

interface ConnectionStatus {
  connecting: boolean;
  connected: boolean;
  lastConnectionError?: Error;
}

interface State {
  players: Player[];
  updatedAt: number;
  areVotesVisible: boolean;
}

const useSocket = (serverUrl: string, roomName: string) => {
  const initialConnectionStatus = { connecting: true, connected: false };
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    initialConnectionStatus,
  );
  const [state, setState] = useState<State>();
  const socketRef = useRef<SocketIOClient.Socket>();

  useEffect(() => {
    socketRef.current = socketIo(serverUrl, { query: { roomName } });
    socketRef.current.on('connect', () => {
      console.log('io: connect');
      setConnectionStatus({ connecting: false, connected: true });
      socketRef.current?.emit('join', {
        playerName: localStorage.getItem('playerName') || 'Unnamed',
      });
    });
    socketRef.current.on('connect_error', (error: Error) => {
      console.error('io: connect_error', error);
      setConnectionStatus({ connecting: false, connected: false, lastConnectionError: error });
    });
    socketRef.current.on('reconnecting', () => {
      console.log('io: reconnecting');
      setConnectionStatus({ connecting: true, connected: false });
    });
    socketRef.current.on('disconnect', () => {
      console.log('io: disconnect');
      setConnectionStatus({ connecting: false, connected: false });
      setState(undefined);
    });
    socketRef.current.on('state', (state: State) => {
      console.log('io: state', state);
      setState(state);
    });

    return (): void => {
      socketRef.current?.close();
    };
  }, [serverUrl, roomName]);

  return {
    connectionStatus,
    state,
    socketRef,
  };
};

const PlayerNameCell: React.FC<Player> = ({ name, votedAt }) => {
  const classes = useStyles();
  const [className, setClassName] = useState(classes.blinkTransition);

  useEffect(() => {
    if (votedAt) {
      setClassName(classes.blinkGreen);
      setTimeout(() => setClassName(classes.blinkTransition), 100);
    }
  }, [votedAt, classes.blinkGreen, classes.blinkTransition]);

  return (
    <TableCell className={className}>
      {votedAt ? '✔' : ' '}
      {name}
    </TableCell>
  );
};

const VotingResults: React.FC<State> = ({ players }) => {
  const votedPlayers = players.filter((player) => player.vote);
  const votesSum = votedPlayers.reduce(
    (accumulator, player) => accumulator + (player.vote || 0),
    0,
  );
  const averageVote = votesSum / votedPlayers.length;

  return (
    <TableRow>
      <TableCell align="right">Average</TableCell>
      <TableCell>{averageVote}</TableCell>
    </TableRow>
  );
};

export const App: React.FC = () => {
  const classes = useStyles();
  const { connectionStatus, state, socketRef } = useSocket('/', 'spyglass');

  const voteValues = [0.5, 1, 1.5, 2, 3, 4, 5, 6, 7, 8];

  const someoneVoted = state?.players.some((player) => player.votedAt);
  const showVotesButtonEnabled = someoneVoted && !state?.areVotesVisible;
  const clearVotesButtonEnabled = someoneVoted && state?.areVotesVisible;

  return (
    <>
      <CssBaseline />
      <AppBar position="absolute" color="default" className={classes.appBar}>
        <Toolbar>
          <Typography variant="h6" color="inherit" noWrap>
            Planning Poker
          </Typography>
        </Toolbar>
      </AppBar>
      <main className={classes.layout}>
        <Paper className={classes.paper}>
          {!connectionStatus.connected && connectionStatus.lastConnectionError && (
            <Alert severity="error">
              Connection error: {connectionStatus.lastConnectionError.message}
            </Alert>
          )}
          <form noValidate autoComplete="off" onSubmit={(event) => event.preventDefault()}>
            <TextField
              id="standard-basic"
              label="Name"
              defaultValue={localStorage.getItem('playerName')}
              onChange={(event) => {
                const playerName = event.target.value;
                localStorage.setItem('playerName', playerName);
                socketRef.current?.emit('renameSelf', { playerName });
              }}
            />
          </form>
          <Button
            className={classes.button}
            variant="contained"
            color="secondary"
            onClick={() => socketRef.current?.emit('clearVotes')}
            disabled={!clearVotesButtonEnabled}
          >
            Clear Votes
          </Button>
          <Button
            className={classes.button}
            variant="contained"
            color="primary"
            onClick={() => socketRef.current?.emit('showVotes')}
            disabled={!showVotesButtonEnabled}
          >
            Show Votes
          </Button>
          <ButtonGroup
            className={classes.voteButtonsGroup}
            variant="text"
            color="primary"
            aria-label="text primary button group"
          >
            {voteValues.map((voteValue) => (
              <Button
                key={voteValue}
                onClick={() => socketRef.current?.emit('vote', { vote: voteValue })}
              >
                {voteValue}
              </Button>
            ))}
          </ButtonGroup>
          <TableContainer className={classes.votesTable}>
            <Table aria-label="simple table">
              <TableHead>
                <TableRow>
                  <TableCell>Player</TableCell>
                  <TableCell>Points</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {state?.players.map((player) => (
                  <TableRow key={player.id}>
                    <PlayerNameCell {...player} />
                    <TableCell>{player.vote}</TableCell>
                  </TableRow>
                ))}
                {state?.areVotesVisible && <VotingResults {...state} />}
              </TableBody>
            </Table>
          </TableContainer>
          <Backdrop open={connectionStatus.connecting} className={classes.backdrop}>
            <CircularProgress color="inherit" />
          </Backdrop>
        </Paper>
      </main>
    </>
  );
};
