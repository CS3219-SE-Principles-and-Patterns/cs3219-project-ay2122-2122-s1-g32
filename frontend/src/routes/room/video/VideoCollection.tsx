/* eslint-disable jsx-a11y/interactive-supports-focus */
import { FC, ReactElement, useEffect, useState } from 'react';
import {
  AgoraVideoPlayer,
  createClient,
  createMicrophoneAndCameraTracks,
} from 'agora-rtc-react';
import AgoraRTC, {
  ClientConfig,
  IAgoraRTCRemoteUser,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
} from 'agora-rtc-sdk-ng';

import Typography from 'components/typography';
import { useUser } from 'contexts/UserContext';
import VideoApi from 'lib/videoService';

import './VideoCollection.scss';

const config: ClientConfig = {
  mode: 'rtc',
  codec: 'vp8',
};

const appId = process.env.REACT_APP_AGORA_APP_ID ?? '';

if (process.env.NODE_ENV !== 'development') {
  AgoraRTC.setLogLevel(4);
}

const useClient = createClient(config);
const useMicrophoneAndCameraTracks = createMicrophoneAndCameraTracks();

const Controls = (props: {
  tracks?: [IMicrophoneAudioTrack, ICameraVideoTrack];
  username: string;
}): ReactElement<'div'> => {
  const { tracks, username } = props;
  const [trackState, setTrackState] = useState({ video: true, audio: true });

  const toggle = async (type: 'audio' | 'video'): Promise<void> => {
    if (!tracks) {
      return;
    }
    if (type === 'audio') {
      await tracks[0].setEnabled(!trackState.audio);
      setTrackState((ps) => {
        return { ...ps, audio: !ps.audio };
      });
    } else if (type === 'video') {
      await tracks[1].setEnabled(!trackState.video);
      setTrackState((ps) => {
        return { ...ps, video: !ps.video };
      });
    }
  };

  return (
    <div className="controls">
      <Typography className="controls--username" size="regular">
        {username}
      </Typography>
      {tracks && (
        <div className="controls--icons">
          <div className="controls--icon-wrapper">
            <i
              className={`fas ${
                trackState.audio ? 'fa-microphone' : 'fa-microphone-slash'
              }`}
              onClick={(): Promise<void> => toggle('audio')}
              onKeyDown={(): Promise<void> => toggle('audio')}
              role="button"
            />
          </div>
          <div className="controls--icon-wrapper">
            <i
              className={`fas ${
                trackState.video ? 'fa-video' : 'fa-video-slash'
              }`}
              onClick={(): Promise<void> => toggle('video')}
              onKeyDown={(): Promise<void> => toggle('video')}
              role="button"
            />
          </div>
        </div>
      )}
    </div>
  );
};

interface Props {
  partnerUsername: string;
  roomId: string;
}

const VideoCollection: FC<Props> = ({ partnerUsername, roomId }) => {
  const [inCall, setInCall] = useState(true);
  const [users, setUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [start, setStart] = useState<boolean>(false);
  const [hasInitialised, setHasInitialised] = useState<boolean>(false);
  const client = useClient();
  const { ready, tracks } = useMicrophoneAndCameraTracks();
  const user = useUser();

  const getToken = async (roomId: string): Promise<string> => {
    try {
      const response = await VideoApi.getToken(roomId);
      return response.token;
    } catch (error) {
      return '';
    }
  };

  useEffect(() => {
    // function to initialise the SDK
    if (!appId) {
      return;
    }

    const init = async (channelName: string): Promise<void> => {
      client.on('user-published', async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        if (mediaType === 'video') {
          setUsers((prevUsers) => {
            return [...prevUsers, user];
          });
        }
        if (mediaType === 'audio') {
          user.audioTrack?.play();
        }
      });

      client.on('user-unpublished', (user, type) => {
        if (type === 'audio') {
          user.audioTrack?.stop();
        }
        if (type === 'video') {
          setUsers((prevUsers) => {
            return prevUsers.filter((User) => User.uid !== user.uid);
          });
        }
      });

      client.on('user-left', (user) => {
        setUsers((prevUsers) => {
          return prevUsers.filter((User) => User.uid !== user.uid);
        });
      });

      const token = await getToken(channelName);
      await client.join(appId, channelName, token, null);
      setInCall(true);
      if (tracks) {
        await client.publish([tracks[0], tracks[1]]);
      }
      setStart(true);
    };

    if (ready && tracks && !hasInitialised) {
      setHasInitialised(true);
      init(roomId);
    }
  }, [roomId, client, ready, tracks, hasInitialised]);

  if (!client || !user) {
    return null;
  }

  return (
    <div className="video-call-container">
      {inCall && start && tracks && (
        <>
          <div className="video-panel">
            <AgoraVideoPlayer className="video" videoTrack={tracks[1]} />
            <Controls tracks={tracks} username={user.githubUsername} />
          </div>
          {users.length > 0 && users[0].videoTrack ? (
            <div className="video-panel">
              <AgoraVideoPlayer
                className="video"
                videoTrack={users[0].videoTrack}
              />
              <Controls username={partnerUsername} />
            </div>
          ) : (
            <div className="video-panel">
              <Controls username={partnerUsername} />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default VideoCollection;
