import * as React from "react";
import {
  Controller,
  FormProvider,
  useFormContext,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

const FormFieldContext = React.createContext<{ name: string } | null>(null);

export function Form<TFieldValues extends FieldValues>({
  children,
  ...props
}: React.ComponentProps<typeof FormProvider<TFieldValues>>) {
  return <FormProvider {...props}>{children}</FormProvider>;
}

export function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(props: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: String(props.name) }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

export function FormItem({ className = "", children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={className}>{children}</div>;
}

export function FormControl({ className = "", children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={className}>{children}</div>;
}

export function FormMessage({ className = "" }: React.HTMLAttributes<HTMLParagraphElement>) {
  const field = React.useContext(FormFieldContext);
  const { formState } = useFormContext();

  if (!field) {
    return null;
  }

  const fieldError = formState.errors[field.name as keyof typeof formState.errors];
  const message = fieldError && typeof fieldError === "object" && "message" in fieldError
    ? String(fieldError.message ?? "")
    : "";

  if (!message) {
    return null;
  }

  return <p className={className}>{message}</p>;
}
