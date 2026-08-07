import { BUNNY_STREAM_REACT_NATIVE_VERSION } from 'bunny-stream-react-native';
import { StyleSheet, Text, View } from 'react-native';

function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        Bunny Stream React Native{'\n'}v{BUNNY_STREAM_REACT_NATIVE_VERSION}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default App;
