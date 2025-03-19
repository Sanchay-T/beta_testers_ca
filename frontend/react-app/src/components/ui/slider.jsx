import * as React from "react";
import * as Slider from "@radix-ui/react-slider";

const SliderDemo = ({ defaultValue, max, step, onChange }) => (
  <Slider.Root
    className="relative flex h-5 w-[200px] touch-none select-none items-center"
    defaultValue={defaultValue}
    max={max}
    step={step}
    onValueChange={onChange}
  >
    <Slider.Track className="relative h-[6px] grow rounded-full bg-gray-200 border border-gray-300">
      <Slider.Range className="absolute h-full rounded-full bg-primary" />
    </Slider.Track>
    <Slider.Thumb
      className="block size-5 rounded-full bg-primary border border-primary-foreground shadow-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      aria-label="Slider"
    />
  </Slider.Root>
);

export default SliderDemo;
