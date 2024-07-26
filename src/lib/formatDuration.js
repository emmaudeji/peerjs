export const formatDuration = (durationInSeconds) => {
    const hours = Math.floor(durationInSeconds / 3600);
    const minutes = Math.floor((durationInSeconds % 3600) / 60);
    const seconds = Math.floor(durationInSeconds % 60);
  
    const pad = (num) => (num < 10 ? `0${num}` : num);
  
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };
  