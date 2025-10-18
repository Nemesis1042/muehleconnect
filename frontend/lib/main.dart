import 'package:flutter/material.dart';
import 'screens/home_screen.dart';

void main() {
  runApp(const MuehleConnect());
}

class MuehleConnect extends StatelessWidget {
  const MuehleConnect({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MühleConnect',
      theme: ThemeData(primarySwatch: Colors.blue),
      home: const HomeScreen(),
    );
  }
}
