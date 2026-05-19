import Svg, { Circle, Line, Path } from 'react-native-svg';
import { theme } from '../constants/theme';

interface Props {
  width?: number;
  height?: number;
  color?: string;
}

export default function MinidoLogo({ width = 104, height = 18, color = theme.cream }: Props) {
  const scale = width / 130;
  const h = height;
  return (
    <Svg viewBox="0 0 130 22" width={width} height={h} fill="none">
      {/* M */}
      <Path d="M2 18V4l7 8 7-8v14" stroke={color} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
      {/* I */}
      <Line x1="22" y1="4" x2="22" y2="18" stroke={color} strokeWidth="1.1" strokeLinecap="round"/>
      {/* N */}
      <Path d="M28 18V4l8 14V4" stroke={color} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
      {/* I */}
      <Line x1="42" y1="4" x2="42" y2="18" stroke={color} strokeWidth="1.1" strokeLinecap="round"/>
      {/* D */}
      <Path d="M48 4h5a7 7 0 0 1 0 14h-5V4z" stroke={color} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
      {/* O */}
      <Circle cx="73" cy="11" r="7" stroke={color} strokeWidth="1.1"/>
    </Svg>
  );
}
