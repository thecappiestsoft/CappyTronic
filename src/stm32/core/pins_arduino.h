// CappyTronic – piny płytki Blue Pill (STM32F103C8T6): numer = port * 16 + bit
#pragma once
#include <stdint.h>
enum { PA0 = 0, PA1, PA2, PA3, PA4, PA5, PA6, PA7, PA8, PA9, PA10, PA11, PA12, PA13, PA14, PA15,
       PB0, PB1, PB2, PB3, PB4, PB5, PB6, PB7, PB8, PB9, PB10, PB11, PB12, PB13, PB14, PB15,
       PC0, PC1, PC2, PC3, PC4, PC5, PC6, PC7, PC8, PC9, PC10, PC11, PC12, PC13, PC14, PC15, NUM_DIGITAL_PINS };
#define LED_BUILTIN PC13
#define LED_GREEN PC13
#define USER_BTN PA0
#define A0 PA0
#define A1 PA1
#define A2 PA2
#define A3 PA3
#define A4 PA4
#define A5 PA5
#define A6 PA6
#define A7 PA7
#define A8 PB0
#define A9 PB1
#define NUM_ANALOG_INPUTS 10
static const uint8_t SS = PA4, MOSI = PA7, MISO = PA6, SCK = PA5, SDA = PB7, SCL = PB6;
#define PIN_WIRE_SDA PB7
#define PIN_WIRE_SCL PB6
#define PIN_SERIAL_TX PA9
#define PIN_SERIAL_RX PA10
#define digitalPinToPort(p) ((p) >> 4)
#define digitalPinToBitMask(p) (1u << ((p) & 15))
#define portOutputRegister(port) (&(((GPIO_TypeDef *[]){GPIOA, GPIOB, GPIOC})[(port)]->ODR))
#define portInputRegister(port) (&(((GPIO_TypeDef *[]){GPIOA, GPIOB, GPIOC})[(port)]->IDR))
#define portSetRegister(port) (&(((GPIO_TypeDef *[]){GPIOA, GPIOB, GPIOC})[(port)]->BSRR))
#define portClearRegister(port) (&(((GPIO_TypeDef *[]){GPIOA, GPIOB, GPIOC})[(port)]->BRR))
#define digitalPinToInterrupt(p) (p)
#define digitalPinIsValid(p) ((p) < NUM_DIGITAL_PINS)
#define analogInputToDigitalPin(p) ((p) < 8 ? (p) : (p) + 8)
