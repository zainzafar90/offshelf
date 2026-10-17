import { useState } from "react";
import { errorMessage } from "../../core/errors";
import { toast } from "../shared/toast";

/* An action resolves false when it already reported its own failure. */
export type SubmitAction = () => Promise<boolean>;

export function useSubmit() {
  const [pending, setPending] = useState(false);

  const submit = async (action: SubmitAction): Promise<boolean> => {
    if (pending) return false;

    setPending(true);

    try {
      return await action();
    } catch (error) {
      toast(errorMessage(error), "error");

      return false;
    } finally {
      setPending(false);
    }
  };

  return { pending, submit };
}
