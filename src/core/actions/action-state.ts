export type FormActionState = {
    status:
      | "IDLE"
      | "SUCCESS"
      | "ERROR";
  
    message: string | null;
  };
  
  export const initialFormActionState: FormActionState =
    {
      status: "IDLE",
      message: null,
    };