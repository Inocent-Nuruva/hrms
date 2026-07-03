import { Textarea } from "@/components/ui/textarea"

export default function TextareaDemo() {
  return (
    <div className="w-3/4">
      <Textarea
        placeholder="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat."
        style={{ minHeight: 100 }}
      />
    </div>
  )
}
