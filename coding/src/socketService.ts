import Automerge from 'automerge';
import axios from 'axios';
import { Server } from 'socket.io';

import {
  base64StringToBinaryChange,
  binaryChangeToBase64String,
  initDocWithText,
  Language,
  TextDoc,
} from './automergeUtils';
import {
  CONNECT,
  DISCONNECT,
  REQ_CHANGE_LANGUAGE,
  REQ_EXECUTE_CODE,
  REQ_JOIN_ROOM,
  REQ_LEAVE_ROOM,
  REQ_UPDATE_CODE,
  REQ_UPDATE_CURSOR,
  RES_CHANGED_LANGUAGE,
  RES_CODE_OUTPUT,
  RES_EXECUTING_CODE,
  RES_JOINED_ROOM,
  RES_UPDATED_CODE,
  RES_UPDATED_CURSOR,
} from './constants';

const socketIdToRoomId = new Map<string, string>();
const roomIdToDoc = new Map<string, Automerge.Doc<TextDoc>>();
const roomIdToLanguage = new Map<string, Language>();
const languageToId = {
  PYTHON: 'Python (3.8.1)',
  JAVA: 'Java (OpenJDK 13.0.1)',
  JAVASCRIPT: 'JavaScript (Node.js 12.14.0)',
};

const setUpIo = (io: Server): void => {
  io.on('connect', (socket) => {
    console.log('IO connected');
    socket.on(CONNECT, () => console.log('Socket connected!'));

    socket.on(REQ_JOIN_ROOM, (roomId: string) => {
      if (socketIdToRoomId.has(socket.id)) {
        socket.leave(socketIdToRoomId.get(socket.id)!);
      }
      socket.join(roomId);
      socketIdToRoomId.set(socket.id, roomId);

      if (!roomIdToDoc.has(roomId)) {
        roomIdToDoc.set(roomId, initDocWithText(''));
        roomIdToLanguage.set(roomId, Language.PYTHON);
      }
      const allChanges = binaryChangeToBase64String(
        Automerge.getAllChanges(roomIdToDoc.get(roomId)!),
      );
      const language = roomIdToLanguage.get(roomId)!;
      socket.emit(RES_JOINED_ROOM, { allChanges, language });
    });

    socket.on(REQ_LEAVE_ROOM, () => {
      if (socketIdToRoomId.has(socket.id)) {
        socket.leave(socketIdToRoomId.get(socket.id)!);
      }
    });

    socket.on(REQ_UPDATE_CODE, (data: string[]) => {
      const roomId = socketIdToRoomId.get(socket.id);
      if (!roomId) {
        console.log('Missing room!');
        return;
      }
      const doc = roomIdToDoc.get(roomId);
      if (!doc) {
        console.log('Missing doc!');
        return;
      }
      const [newDoc] = Automerge.applyChanges(
        Automerge.clone(doc),
        base64StringToBinaryChange(data),
      );
      roomIdToDoc.set(roomId, newDoc);
      socket.to(roomId).emit(RES_UPDATED_CODE, data);
    });

    socket.on(
      REQ_UPDATE_CURSOR,
      (data: {
        startRow: number;
        startCol: number;
        endRow: number;
        endCol: number;
      }) => {
        const roomId = socketIdToRoomId.get(socket.id);
        if (!roomId) {
          console.log('Missing room!');
          return;
        }
        socket.to(roomId).emit(RES_UPDATED_CURSOR, data);
      },
    );

    socket.on(REQ_CHANGE_LANGUAGE, (language: Language) => {
      const roomId = socketIdToRoomId.get(socket.id);
      if (!roomId) {
        console.log('Missing room!');
        return;
      }
      roomIdToLanguage.set(roomId, language);
      socket.to(roomId).emit(RES_CHANGED_LANGUAGE, language);
    });

    socket.on(REQ_EXECUTE_CODE, async () => {
      const roomId = socketIdToRoomId.get(socket.id);
      if (!roomId) {
        console.log('Missing room!');
        return;
      }
      const doc = roomIdToDoc.get(roomId);
      if (!doc) {
        console.log('Missing doc!');
        return;
      }
      const language = roomIdToLanguage.get(roomId);
      if (!language) {
        console.log('Missing language!');
        return;
      }

      if (doc.text.length === 0) {
        console.log('Empty code!');
        return;
      }
      io.to(roomId).emit(RES_EXECUTING_CODE);

      const data = {
        code: doc.text.toString(),
        language: languageToId[language],
      };

      console.log('Executing code now...');

      const resp = await axios.post(
        `${process.env.CODE_EXECUTOR_URL}/submission`,
        data,
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );

      if (resp.status != 200 || resp.data.result == null) {
        console.error(resp.status);
        // TODO: handle error.
        return;
      }

      const execResult = await axios.get(
        `${process.env.CODE_EXECUTOR_URL}/submission/${resp.data.result}`,
      );

      if (execResult.status != 200) {
        console.error(execResult.data.error);
        // TODO: handle error.
        return;
      }

      switch (execResult.data.status.id) {
        case 3:
          io.to(roomId).emit(RES_CODE_OUTPUT, execResult.data.stdout);
          return;
        case 5:
          io.to(roomId).emit(
            RES_CODE_OUTPUT,
            `Time limit exceeded${
              execResult.data.stderr ? `:\n${execResult.data.stderr}` : '.'
            }`,
          );
          return;
        case 6:
          io.to(roomId).emit(
            RES_CODE_OUTPUT,
            `Compilation error${
              execResult.data.stderr ? `:\n${execResult.data.stderr}` : '.'
            }`,
          );
          return;
        case 7:
        case 8:
        case 9:
        case 10:
        case 11:
        case 12:
          io.to(roomId).emit(
            RES_CODE_OUTPUT,
            `Runtime error${
              execResult.data.stderr ? `:\n${execResult.data.stderr}` : '.'
            }`,
          );
          return;
        case 13:
          io.to(roomId).emit(
            RES_CODE_OUTPUT,
            `Internal error${
              execResult.data.stderr ? `:\n${execResult.data.stderr}` : '.'
            }`,
          );
          return;
        case 14:
          io.to(roomId).emit(
            RES_CODE_OUTPUT,
            `Something went wrong${
              execResult.data.stderr ? `:\n${execResult.data.stderr}` : '.'
            }`,
          );
          return;
      }
    });

    socket.on(DISCONNECT, () => {
      socketIdToRoomId.delete(socket.id);
    });
  });
  console.log('IO has been set up.');
};

export default setUpIo;
