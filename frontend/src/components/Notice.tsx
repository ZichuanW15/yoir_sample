import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/src/theme';
export function Notice({message,tone='info'}:{message:string;tone?:'info'|'error'}){return <View accessibilityRole={tone==='error'?'alert':undefined} style={[styles.box,tone==='error'&&styles.errorBox]}><Text style={[styles.text,tone==='error'&&styles.errorText]}>{message}</Text></View>}
const styles=StyleSheet.create({box:{padding:12,borderRadius:radius.sm,backgroundColor:colors.primarySoft},errorBox:{backgroundColor:'#FDECEF'},text:{color:colors.primaryDark,lineHeight:20},errorText:{color:colors.danger}});
