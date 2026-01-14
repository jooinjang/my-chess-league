import { useState, useCallback, useMemo, useRef } from 'react';
import { Chess } from 'chess.js';
import { ChessMove, MoveNode } from '../types/analysis';

let nodeIdCounter = 0;
function generateNodeId(): string {
  return `node_${++nodeIdCounter}`;
}

function createMoveNode(
  move: ChessMove | null,
  fen: string,
  parent: MoveNode | null,
  isMainLine: boolean
): MoveNode {
  return {
    id: generateNodeId(),
    move,
    fen,
    children: [],
    parent,
    isMainLine,
    depth: parent ? parent.depth + 1 : 0,
    moveIndex: parent ? parent.moveIndex + 1 : -1,
  };
}

// Helper to get all moves on the main line
function getMainLineMoves(root: MoveNode): ChessMove[] {
  const moves: ChessMove[] = [];
  let current = root;
  while (current.children.length > 0) {
    const mainChild = current.children[0];
    if (mainChild.move) {
      moves.push(mainChild.move);
    }
    current = mainChild;
  }
  return moves;
}

// Helper to get positions on the main line
function getMainLinePositions(root: MoveNode): string[] {
  const positions: string[] = [root.fen];
  let current = root;
  while (current.children.length > 0) {
    const mainChild = current.children[0];
    positions.push(mainChild.fen);
    current = mainChild;
  }
  return positions;
}

// Get the path from root to a node
function getPathToNode(node: MoveNode): MoveNode[] {
  const path: MoveNode[] = [];
  let current: MoveNode | null = node;
  while (current) {
    path.unshift(current);
    current = current.parent;
  }
  return path;
}

// Check if a node is on the main line
function isOnMainLine(node: MoveNode): boolean {
  let current: MoveNode | null = node;
  while (current && current.parent) {
    if (current.parent.children[0] !== current) {
      return false;
    }
    current = current.parent;
  }
  return true;
}

interface UseChessGameReturn {
  game: Chess;
  fen: string;
  moves: ChessMove[];
  currentMoveIndex: number;
  isAtStart: boolean;
  isAtEnd: boolean;
  turn: 'w' | 'b';
  loadPgn: (pgn: string) => boolean;
  goToMove: (index: number) => void;
  goToStart: () => void;
  goToEnd: () => void;
  goForward: () => void;
  goBack: () => void;
  reset: () => void;
  // Returns the resulting move (including the resulting FEN) if legal.
  makeMove: (from: string, to: string, promotion?: string) => ChessMove | null;
  undoMove: () => void;
  getPositions: () => string[];
  commentsByPly: Array<string | null>;

  // Variation support
  moveTree: MoveNode | null;
  currentNode: MoveNode | null;
  currentLineMoves: ChessMove[];
  goToNode: (node: MoveNode) => void;
  goToMainLine: () => void;
  isInVariation: boolean;
  hasVariations: boolean;
  deleteVariation: (node: MoveNode) => void;
  promoteVariation: (node: MoveNode) => void;
}

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function useChessGame(): UseChessGameReturn {
  const [game] = useState(() => new Chess());
  const [moveTree, setMoveTree] = useState<MoveNode | null>(null);
  const [currentNode, setCurrentNode] = useState<MoveNode | null>(null);
  const [commentsByPly, setCommentsByPly] = useState<Array<string | null>>([]);
  const analysisGameRef = useRef(new Chess());

  // Derived state from tree
  const fen = useMemo(() => {
    return currentNode?.fen || INITIAL_FEN;
  }, [currentNode]);

  const turn = useMemo(() => {
    const fenParts = fen.split(' ');
    return (fenParts[1] || 'w') as 'w' | 'b';
  }, [fen]);

  // Get moves along the current line (from root to current position)
  // Used for tracking current path including variations
  const currentLineMoves = useMemo(() => {
    if (!currentNode || !moveTree) return [];
    const path = getPathToNode(currentNode);
    return path
      .filter(node => node.move !== null)
      .map(node => node.move!);
  }, [currentNode, moveTree]);

  const currentMoveIndex = useMemo(() => {
    return currentNode ? currentNode.moveIndex : -1;
  }, [currentNode]);

  const isAtStart = useMemo(() => {
    return !currentNode || currentNode.parent === null;
  }, [currentNode]);

  const isAtEnd = useMemo(() => {
    return !currentNode || currentNode.children.length === 0;
  }, [currentNode]);

  const isInVariation = useMemo(() => {
    return currentNode ? !isOnMainLine(currentNode) : false;
  }, [currentNode]);

  const hasVariations = useMemo(() => {
    if (!moveTree) return false;
    const checkForVariations = (node: MoveNode): boolean => {
      if (node.children.length > 1) return true;
      return node.children.some(child => checkForVariations(child));
    };
    return checkForVariations(moveTree);
  }, [moveTree]);

  const loadPgn = useCallback((pgn: string): boolean => {
    try {
      const tempGame = new Chess();
      tempGame.loadPgn(pgn);

      if (tempGame.history().length === 0 && pgn.trim().length > 0) {
        const hasValidContent = pgn.includes('1.') || pgn.includes('[Event');
        if (!hasValidContent) {
          return false;
        }
      }

      // Create the move tree
      const root = createMoveNode(null, INITIAL_FEN, null, true);
      let currentParent = root;

      const history = tempGame.history({ verbose: true });
      const replayGame = new Chess();
      const fenToPlyIndex = new Map<string, number>();

      for (const move of history) {
        replayGame.move(move.san);
        const plyIndex = fenToPlyIndex.size; // 0-based ply index
        fenToPlyIndex.set(replayGame.fen(), plyIndex);

        const chessMove: ChessMove = {
          san: move.san,
          from: move.from,
          to: move.to,
          color: move.color,
          piece: move.piece,
          flags: move.flags,
          fen: replayGame.fen(),
        };

        const newNode = createMoveNode(chessMove, replayGame.fen(), currentParent, true);
        currentParent.children.push(newNode);
        currentParent = newNode;
      }

      // Map chess.js position comments (keyed by FEN) back to ply indices
      const comments: Array<string | null> = Array(history.length).fill(null);
      const rawComments = tempGame.getComments(); // [{ fen, comment }]
      for (const c of rawComments) {
        const idx = fenToPlyIndex.get(c.fen);
        if (idx === undefined) continue;
        comments[idx] = c.comment;
      }

      nodeIdCounter = 0; // Reset counter for consistent IDs
      setMoveTree(root);
      setCurrentNode(root);
      setCommentsByPly(comments);
      game.reset();

      return true;
    } catch {
      return false;
    }
  }, [game]);

  const goToNode = useCallback((node: MoveNode) => {
    setCurrentNode(node);
  }, []);

  const goToMove = useCallback((index: number) => {
    if (!moveTree) return;

    // Navigate along main line to the given index
    let current = moveTree;
    for (let i = 0; i <= index && current.children.length > 0; i++) {
      current = current.children[0];
    }
    setCurrentNode(index === -1 ? moveTree : current);
  }, [moveTree]);

  const goToStart = useCallback(() => {
    if (moveTree) {
      setCurrentNode(moveTree);
    }
  }, [moveTree]);

  const goToEnd = useCallback(() => {
    if (!currentNode) return;

    // Follow the first child (main line or current variation line) to the end
    let current = currentNode;
    while (current.children.length > 0) {
      current = current.children[0];
    }
    setCurrentNode(current);
  }, [currentNode]);

  const goForward = useCallback(() => {
    if (currentNode && currentNode.children.length > 0) {
      // Go to first child (main continuation)
      setCurrentNode(currentNode.children[0]);
    }
  }, [currentNode]);

  const goBack = useCallback(() => {
    if (currentNode && currentNode.parent) {
      setCurrentNode(currentNode.parent);
    }
  }, [currentNode]);

  const goToMainLine = useCallback(() => {
    if (!moveTree || !currentNode) return;

    // Find the point where we diverged from main line and go there
    const path = getPathToNode(currentNode);

    // Find the last node that is on the main line
    for (let i = path.length - 1; i >= 0; i--) {
      if (isOnMainLine(path[i])) {
        setCurrentNode(path[i]);
        return;
      }
    }

    setCurrentNode(moveTree);
  }, [moveTree, currentNode]);

  const reset = useCallback(() => {
    setMoveTree(null);
    setCurrentNode(null);
    setCommentsByPly([]);
    game.reset();
    analysisGameRef.current.reset();
  }, [game]);

  const makeMove = useCallback((from: string, to: string, promotion?: string): ChessMove | null => {
    if (!currentNode) return null;

    analysisGameRef.current.load(currentNode.fen);

    try {
      const move = analysisGameRef.current.move({ from, to, promotion });
      if (!move) return null;

      const newFen = analysisGameRef.current.fen();
      const newChessMove: ChessMove = {
        san: move.san,
        from: move.from,
        to: move.to,
        color: move.color,
        piece: move.piece,
        flags: move.flags,
        fen: newFen,
      };

      // Check if this move already exists as a child
      const existingChild = currentNode.children.find(
        child => child.move?.san === newChessMove.san
      );

      if (existingChild) {
        // Move already exists, just navigate to it
        setCurrentNode(existingChild);
        return existingChild.move;
      }

      // Create new node for the variation
      const isMainLineContinuation = currentNode.children.length === 0 && isOnMainLine(currentNode);
      const newNode = createMoveNode(
        newChessMove,
        newFen,
        currentNode,
        isMainLineContinuation
      );

      // Add to parent's children (variations are added after main line)
      const updatedTree = moveTree ? { ...moveTree } : createMoveNode(null, INITIAL_FEN, null, true);

      // Find and update the current node in the tree
      const updateNodeInTree = (node: MoveNode): MoveNode => {
        if (node.id === currentNode.id) {
          return {
            ...node,
            children: [...node.children, newNode],
          };
        }
        return {
          ...node,
          children: node.children.map(child => {
            const updated = updateNodeInTree(child);
            if (updated !== child) {
              updated.parent = node;
            }
            return updated;
          }),
        };
      };

      // For simpler implementation, directly mutate (React will still detect the state change)
      currentNode.children.push(newNode);

      setMoveTree({ ...updatedTree });
      setCurrentNode(newNode);

      return newChessMove;
    } catch {
      return null;
    }
  }, [currentNode, moveTree]);

  const undoMove = useCallback(() => {
    if (currentNode && currentNode.parent) {
      setCurrentNode(currentNode.parent);
    }
  }, [currentNode]);

  const getPositions = useCallback(() => {
    if (!moveTree) return [INITIAL_FEN];
    return getMainLinePositions(moveTree);
  }, [moveTree]);

  const deleteVariation = useCallback((node: MoveNode) => {
    if (!node.parent || !moveTree) return;

    // Can't delete main line
    if (isOnMainLine(node)) return;

    const parent = node.parent;
    const childIndex = parent.children.indexOf(node);
    if (childIndex > 0) { // Don't delete main line (index 0)
      parent.children.splice(childIndex, 1);
      setMoveTree({ ...moveTree });

      // If we're on the deleted variation, go to parent
      const pathToCurrentNode = getPathToNode(currentNode!);
      if (pathToCurrentNode.includes(node)) {
        setCurrentNode(parent);
      }
    }
  }, [moveTree, currentNode]);

  const promoteVariation = useCallback((node: MoveNode) => {
    if (!node.parent || !moveTree) return;
    if (isOnMainLine(node)) return;

    const parent = node.parent;
    const childIndex = parent.children.indexOf(node);
    if (childIndex > 0) {
      // Swap with the first child (make this the main line)
      [parent.children[0], parent.children[childIndex]] =
        [parent.children[childIndex], parent.children[0]];

      // Update isMainLine flags
      const updateMainLineFlags = (n: MoveNode, isMain: boolean) => {
        n.isMainLine = isMain;
        if (n.children.length > 0) {
          updateMainLineFlags(n.children[0], isMain);
        }
      };

      updateMainLineFlags(parent.children[0], true);
      updateMainLineFlags(parent.children[childIndex], false);

      setMoveTree({ ...moveTree });
    }
  }, [moveTree]);

  // For backwards compatibility - get main line moves
  const mainLineMoves = useMemo(() => {
    if (!moveTree) return [];
    return getMainLineMoves(moveTree);
  }, [moveTree]);

  return {
    game,
    fen,
    moves: mainLineMoves, // Return main line for analysis compatibility
    currentMoveIndex,
    isAtStart,
    isAtEnd,
    turn,
    loadPgn,
    goToMove,
    goToStart,
    goToEnd,
    goForward,
    goBack,
    reset,
    makeMove,
    undoMove,
    getPositions,
    commentsByPly,

    // Variation support
    moveTree,
    currentNode,
    currentLineMoves,
    goToNode,
    goToMainLine,
    isInVariation,
    hasVariations,
    deleteVariation,
    promoteVariation,
  };
}
