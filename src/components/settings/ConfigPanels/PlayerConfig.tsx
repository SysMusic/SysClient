import React, { useEffect, useRef, useState } from 'react';
import { ipcRenderer, shell } from 'electron';
import settings from 'electron-settings';
import { Form, Whisper } from 'rsuite';
import { WhisperInstance } from 'rsuite/lib/Whisper';
import { Trans, useTranslation } from 'react-i18next';
import { ConfigOptionDescription, ConfigOptionName, ConfigPanel } from '../styled';
import {
  StyledButton,
  StyledInput,
  StyledInputGroup,
  StyledInputNumber,
  StyledInputPicker,
  StyledInputPickerContainer,
  StyledLink,
  StyledPanel,
  StyledToggle,
} from '../../shared/styled';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import i18n from '../../../i18n/i18n';
import { setPlaybackSetting } from '../../../redux/playQueueSlice';
import ListViewTable from '../../viewtypes/ListViewTable';
import { appendPlaybackFilter, setAudioDeviceId, setPlayer } from '../../../redux/configSlice';
import { notifyToast } from '../../shared/toast';
import ConfigOption from '../ConfigOption';
import { Server } from '../../../types';
import { isWindows, isWindows10 } from '../../../shared/utils';
import Popup from '../../shared/Popup';

const getAudioDevice = async () => {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return (devices || []).filter((dev: MediaDeviceInfo) => dev.kind === 'audiooutput');
};

const playbackFilterColumns = [
  {
    id: '#',
    dataKey: 'index',
    alignment: 'center',
    resizable: false,
    width: 50,
    label: '#',
  },
  {
    id: 'Filter',
    dataKey: 'filter',
    alignment: 'left',
    resizable: false,
    flexGrow: 2,
    label: i18n.t('Filter'),
  },
  {
    id: 'Enabled',
    dataKey: 'filterEnabled',
    alignment: 'left',
    resizable: false,
    width: 100,
    label: i18n.t('Enabled'),
  },
  {
    id: 'Delete',
    dataKey: 'filterDelete',
    alignment: 'left',
    resizable: false,
    width: 100,
    label: i18n.t('Delete'),
  },
];

const PlayerConfig = ({ bordered }: any) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const playQueue = useAppSelector((state) => state.playQueue);
  const multiSelect = useAppSelector((state) => state.multiSelect);
  const config = useAppSelector((state) => state.config);
  const [newFilter, setNewFilter] = useState({ string: '', valid: false });
  const [transcode, setTranscode] = useState(Boolean(settings.getSync('transcode')));
  const [globalMediaHotkeys, setGlobalMediaHotkeys] = useState(
    Boolean(settings.getSync('globalMediaHotkeys'))
  );
  const [systemMediaTransportControls, setSystemMediaTransportControls] = useState(
    Boolean(settings.getSync('systemMediaTransportControls'))
  );
  const [resume, setResume] = useState(Boolean(settings.getSync('resume')));
  const [scrobble, setScrobble] = useState(Boolean(settings.getSync('scrobble')));
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>();
  const audioDevicePickerContainerRef = useRef(null);
  const transcodingRestartWhisper = useRef<WhisperInstance>();

  useEffect(() => {
    settings.setSync('playbackFilters', config.playback.filters);
  }, [config.playback.filters]);

  useEffect(() => {
    const getAudioDevices = () => {
      getAudioDevice()
        .then((dev) => setAudioDevices(dev))
        .catch(() => notifyToast('error', t('Error fetching audio devices')));
    };

    getAudioDevices();
  }, [t]);

  return (
    <ConfigPanel bordered={bordered} header={t('Player')}>
      <ConfigOption
        name={t('Audio Device')}
        description={t(
          'The audio device for SysMusic. Leaving this blank will use the system default.'
        )}
        option={
          <StyledInputPickerContainer ref={audioDevicePickerContainerRef}>
            <StyledInputPicker
              container={() => audioDevicePickerContainerRef.current}
              data={audioDevices}
              defaultValue={config.playback.audioDeviceId}
              value={config.playback.audioDeviceId}
              labelKey="label"
              valueKey="deviceId"
              placement="bottomStart"
              placeholder={t('Select')}
              onChange={(e: string) => {
                dispatch(setAudioDeviceId(e));
                settings.setSync('audioDeviceId', e);
              }}
            />
          </StyledInputPickerContainer>
        }
      />
      <ConfigOption
        name={t('Resume Playback')}
        description={
          <Trans>
            Remember play queue on startup. The current Now Playing queue will be saved on exiting,
            and will be restored when you reopen SysMusic. Be warned that you should manually close
            SysMusic for the queue to be saved. An improper shutdown (such as the app closing during a
            shutdown or force quitting) may result in history not being saved.
          </Trans>
        }
        option={
          <StyledToggle
            defaultChecked={resume}
            checked={resume}
            onChange={(e: boolean) => {
              settings.setSync('resume', e);
              setResume(e);
            }}
          />
        }
      />
      {config.serverType === Server.Jellyfin && (
        <ConfigOption
          name={t('Allow Transcoding')}
          description={t(
            'If your audio files are not playing properly or are not in a supported web streaming format, you will need to enable this (requires app restart).'
          )}
          option={
            <>
              <Whisper
                ref={transcodingRestartWhisper}
                trigger="none"
                placement="auto"
                speaker={
                  <Popup title={t('Restart?')}>
                    <div>{t('Do you want to restart the application now?')}</div>
                    <strong>{t('This is highly recommended!')}</strong>
                    <div>
                      <StyledButton
                        id="titlebar-restart-button"
                        size="sm"
                        onClick={() => {
                          ipcRenderer.send('reload');
                        }}
                        appearance="primary"
                      >
                        {t('Yes')}
                      </StyledButton>
                    </div>
                  </Popup>
                }
              >
                <StyledToggle
                  defaultChecked={transcode}
                  checked={transcode}
                  onChange={(e: boolean) => {
                    settings.setSync('transcode', e);
                    setTranscode(e);
                    transcodingRestartWhisper.current?.open();
                  }}
                />
              </Whisper>
            </>
          }
        />
      )}

      <ConfigOption
        name={t('Global Media Hotkeys')}
        description={
          <Trans>
            Enable or disable global media hotkeys (play/pause, next, previous, stop, etc). For
            macOS, you will need to add SysMusic as a{' '}
            <StyledLink
              onClick={() =>
                shell.openExternal(
                  'https://developer.apple.com/library/archive/documentation/Accessibility/Conceptual/AccessibilityMacOSX/OSXAXTestingApps.html'
                )
              }
            >
              trusted accessibility client.
            </StyledLink>
          </Trans>
        }
        option={
          <StyledToggle
            defaultChecked={globalMediaHotkeys}
            checked={globalMediaHotkeys}
            onChange={(e: boolean) => {
              settings.setSync('globalMediaHotkeys', e);
              setGlobalMediaHotkeys(e);
              if (e) {
                ipcRenderer.send('enableGlobalHotkeys');

                settings.setSync('systemMediaTransportControls', !e);
                setSystemMediaTransportControls(!e);
                ipcRenderer.send('disableSystemMediaTransportControls');
              } else {
                ipcRenderer.send('disableGlobalHotkeys');
              }
            }}
          />
        }
      />

      {isWindows() && isWindows10() && (
        <ConfigOption
          name={t('Windows System Media Transport Controls')}
          description={
            <>
              {t(
                'Enable or disable the Windows System Media Transport Controls (play/pause, next, previous, stop). This will show the Windows Media Popup (Windows 10 only) when pressing a media key. This feauture will override the Global Media Hotkeys option.'
              )}
            </>
          }
          option={
            <StyledToggle
              defaultChecked={systemMediaTransportControls}
              checked={systemMediaTransportControls}
              onChange={(e: boolean) => {
                settings.setSync('systemMediaTransportControls', e);
                setSystemMediaTransportControls(e);
                if (e) {
                  ipcRenderer.send('enableSystemMediaTransportControls');

                  settings.setSync('globalMediaHotkeys', !e);
                  setGlobalMediaHotkeys(!e);
                  ipcRenderer.send('disableGlobalHotkeys');
                } else {
                  ipcRenderer.send('disableSystemMediaTransportControls');
                }
              }}
            />
          }
        />
      )}

      <ConfigOption
        name={t('System Notifications')}
        description={<>{t('Show a system notification whenever the song changes.')}</>}
        option={
          <StyledToggle
            defaultChecked={config.player.systemNotifications}
            checked={config.player.systemNotifications}
            onChange={(e: boolean) => {
              settings.setSync('systemNotifications', e);
              dispatch(setPlayer({ systemNotifications: e }));
            }}
          />
        }
      />
      <br />
    </ConfigPanel>
  );
};

export default PlayerConfig;
