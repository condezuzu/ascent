import Svg, { Circle, Path } from 'react-native-svg';

/** El pin del gimnasio (15/10): una gota hueca con su punto, a trazo, del color del texto. */
export default function PinGimnasio({ tam = 16, color }: { tam?: number; color: string }) {
  return (
    <Svg width={tam * 0.78} height={tam} viewBox="0 0 14 18">
      <Path d="M7 16.6c-.4-.4-5.6-6-5.6-9.9a5.6 5.6 0 0 1 11.2 0c0 3.9-5.2 9.5-5.6 9.9z" fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
      <Circle cx={7} cy={6.7} r={2.1} fill="none" stroke={color} strokeWidth={1.4} />
    </Svg>
  );
}
