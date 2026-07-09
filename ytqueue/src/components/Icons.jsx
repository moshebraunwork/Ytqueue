const I = ({ d, size = 24, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d={d} />
  </svg>
)

export const HomeIcon = (p) => <I {...p} d="M4 10v11h6v-6h4v6h6V10l-8-7z" />
export const ChannelsIcon = (p) => <I {...p} d="M10 9.35 15 12l-5 2.65v-5.3ZM12 5c-2.4 0-4.71.13-6.32.36-.97.16-1.75.94-1.91 1.91C3.55 8.87 3.5 10.43 3.5 12s.05 3.13.27 4.73c.16.97.94 1.75 1.91 1.91 1.61.23 3.92.36 6.32.36s4.71-.13 6.32-.36c.97-.16 1.75-.94 1.91-1.91.22-1.6.27-3.16.27-4.73s-.05-3.13-.27-4.73a2.24 2.24 0 0 0-1.91-1.91C16.71 5.13 14.4 5 12 5Z" />
export const SearchIcon = (p) => <I {...p} d="M20.87 20.17l-5.59-5.59A6.96 6.96 0 0 0 16.5 10c0-3.87-3.13-7-7-7s-7 3.13-7 7 3.13 7 7 7c1.71 0 3.28-.61 4.5-1.63l5.59 5.59.78-.79zM9.5 16c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z" />
export const PlusIcon = (p) => <I {...p} d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z" />
export const AddVideoIcon = (p) => <I {...p} d="M14 13h-3v3H9v-3H6v-2h3V8h2v3h3v2zm3-7H3v12h14v-6.39l4 1.83V8.56l-4 1.83V6m1-1v3.83L22 7v8l-4-1.83V19H2V5h16z" />
export const TrashIcon = (p) => <I {...p} d="M11 17H9V8h2v9zm4-9h-2v9h2V8zm4-4v1h-1v16H6V5H5V4h4V3h6v1h4zm-2 1H7v15h10V5z" />
export const DownloadIcon = (p) => <I {...p} d="M17 18v1H6v-1h11zm-.5-6.6-.7-.7-3.8 3.7V4h-1v10.4l-3.8-3.8-.7.7 5 5 5-4.9z" />
export const PlayIcon = (p) => <I {...p} d="M8 5v14l11-7z" />
export const PauseIcon = (p) => <I {...p} d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
export const CloseIcon = (p) => <I {...p} d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
export const BackIcon = (p) => <I {...p} d="M21 11H6.83l5.59-5.59L11 4l-8 8 8 8 1.41-1.41L6.83 13H21z" />
export const FullscreenIcon = (p) => <I {...p} d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
export const FullscreenExitIcon = (p) => <I {...p} d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
export const VolumeIcon = (p) => <I {...p} d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
export const MuteIcon = (p) => <I {...p} d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z" />
export const BrightnessIcon = (p) => <I {...p} d="M20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm0-10c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z" />
export const CheckIcon = (p) => <I {...p} d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
export const NextIcon = (p) => <I {...p} d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
export const PrevIcon = (p) => <I {...p} d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
export const Replay10Icon = (p) => <I {...p} d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
export const Forward10Icon = (p) => <I {...p} d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" />
export const SpeedIcon = (p) => <I {...p} d="M20.38 8.57l-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44zm-9.79 6.84a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83z" />
export const YoutubeIcon = (p) => <I {...p} d="M14 3h7v7h-1V4.7L9.7 15 9 14.3 19.3 4H14V3zM3 5v16h16v-8h-1v7H4V6h7V5H3z" />
export const LockIcon = (p) => <I {...p} d="M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zM9 6a3 3 0 0 1 6 0v2H9V6zm9 14H6V10h12v10z" />
export const KebabIcon = (p) => <I {...p} d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
export const EyeIcon = (p) => <I {...p} d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
export const LogoIcon = ({ size = 28 }) => (
  <svg width={size} height={size * 0.7} viewBox="0 0 30 21">
    <rect width="30" height="21" rx="5.5" fill="#ff2e55" />
    <path d="M12 6.2v8.6l7.4-4.3z" fill="#fff" />
  </svg>
)
