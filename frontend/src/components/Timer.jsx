import { useEffect, useState } from "react";
import { formatMs } from "../utils/formatters";

export function Timer({ roundEndsAt }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => {
      if (!roundEndsAt) {
        setRemaining(0);
        return;
      }
      setRemaining(Math.max(0, roundEndsAt - Date.now()));
    };

    update();
    const handle = setInterval(update, 1000);
    return () => clearInterval(handle);
  }, [roundEndsAt]);

  return <span>{formatMs(remaining)}</span>;
}
