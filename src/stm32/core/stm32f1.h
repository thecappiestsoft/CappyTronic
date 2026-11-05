// CappyTronic – rejestry STM32F103 (RM0008), tylko to, czego używa rdzeń Arduino
#pragma once
#include <stdint.h>
#define __IO volatile
typedef struct { __IO uint32_t CRL, CRH, IDR, ODR, BSRR, BRR, LCKR; } GPIO_TypeDef;
typedef struct { __IO uint32_t EVCR, MAPR, EXTICR[4], RESERVED0, MAPR2; } AFIO_TypeDef;
typedef struct { __IO uint32_t IMR, EMR, RTSR, FTSR, SWIER, PR; } EXTI_TypeDef;
typedef struct { __IO uint32_t CR, CFGR, CIR, APB2RSTR, APB1RSTR, AHBENR, APB2ENR, APB1ENR, BDCR, CSR; } RCC_TypeDef;
typedef struct { __IO uint32_t ACR, KEYR, OPTKEYR, SR, CR, AR, RESERVED, OBR, WRPR; } FLASH_TypeDef;
typedef struct { __IO uint32_t SR, DR, BRR, CR1, CR2, CR3, GTPR; } USART_TypeDef;
typedef struct { __IO uint32_t CR1, CR2, SMCR, DIER, SR, EGR, CCMR1, CCMR2, CCER, CNT, PSC, ARR, RCR, CCR1, CCR2, CCR3, CCR4, BDTR, DCR, DMAR; } TIM_TypeDef;
typedef struct { __IO uint32_t SR, CR1, CR2, SMPR1, SMPR2, JOFR1, JOFR2, JOFR3, JOFR4, HTR, LTR, SQR1, SQR2, SQR3, JSQR, JDR1, JDR2, JDR3, JDR4, DR; } ADC_TypeDef;
typedef struct { __IO uint32_t CR1, CR2, OAR1, OAR2, DR, SR1, SR2, CCR, TRISE; } I2C_TypeDef;
typedef struct { __IO uint32_t CR1, CR2, SR, DR, CRCPR, RXCRCR, TXCRCR, I2SCFGR, I2SPR; } SPI_TypeDef;
typedef struct { __IO uint32_t KR, PR, RLR, SR; } IWDG_TypeDef;
typedef struct { __IO uint32_t CTRL, LOAD, VAL, CALIB; } SysTick_Type;
typedef struct { __IO uint32_t ISER[8]; uint32_t R0[24]; __IO uint32_t ICER[8]; uint32_t R1[24]; __IO uint32_t ISPR[8]; uint32_t R2[24]; __IO uint32_t ICPR[8]; uint32_t R3[24]; __IO uint32_t IABR[8]; uint32_t R4[56]; __IO uint8_t IP[240]; } NVIC_Type;
typedef struct { __IO uint32_t CPUID, ICSR, VTOR, AIRCR, SCR, CCR; __IO uint8_t SHP[12]; __IO uint32_t SHCSR, CFSR, HFSR, DFSR, MMFAR, BFAR, AFSR; } SCB_Type;
typedef struct { __IO uint32_t CTRL, CYCCNT; } DWT_Type;
#define GPIOA ((GPIO_TypeDef *)0x40010800)
#define GPIOB ((GPIO_TypeDef *)0x40010C00)
#define GPIOC ((GPIO_TypeDef *)0x40011000)
#define AFIO ((AFIO_TypeDef *)0x40010000)
#define EXTI ((EXTI_TypeDef *)0x40010400)
#define RCC ((RCC_TypeDef *)0x40021000)
#define FLASH ((FLASH_TypeDef *)0x40022000)
#define USART1 ((USART_TypeDef *)0x40013800)
#define USART2 ((USART_TypeDef *)0x40004400)
#define USART3 ((USART_TypeDef *)0x40004800)
#define TIM1 ((TIM_TypeDef *)0x40012C00)
#define TIM2 ((TIM_TypeDef *)0x40000000)
#define TIM3 ((TIM_TypeDef *)0x40000400)
#define TIM4 ((TIM_TypeDef *)0x40000800)
#define ADC1 ((ADC_TypeDef *)0x40012400)
#define I2C1 ((I2C_TypeDef *)0x40005400)
#define I2C2 ((I2C_TypeDef *)0x40005800)
#define SPI1 ((SPI_TypeDef *)0x40013000)
#define SPI2 ((SPI_TypeDef *)0x40003800)
#define IWDG ((IWDG_TypeDef *)0x40003000)
#define SysTick ((SysTick_Type *)0xE000E010)
#define NVIC ((NVIC_Type *)0xE000E100)
#define SCB ((SCB_Type *)0xE000ED00)
#define DWT ((DWT_Type *)0xE0001000)
#define CoreDebug_DEMCR (*(volatile uint32_t *)0xE000EDFC)
enum IRQn { EXTI0_IRQn = 6, EXTI1_IRQn, EXTI2_IRQn, EXTI3_IRQn, EXTI4_IRQn, ADC1_2_IRQn = 18, EXTI9_5_IRQn = 23, TIM1_UP_IRQn = 25, TIM2_IRQn = 28, TIM3_IRQn, TIM4_IRQn, I2C1_EV_IRQn, I2C1_ER_IRQn,
  SPI1_IRQn = 35, SPI2_IRQn, USART1_IRQn, USART2_IRQn, USART3_IRQn, EXTI15_10_IRQn };
static inline void NVIC_EnableIRQ(int n) { NVIC->ISER[n >> 5] = 1u << (n & 31); }
static inline void NVIC_DisableIRQ(int n) { NVIC->ICER[n >> 5] = 1u << (n & 31); }
static inline void NVIC_SetPriority(int n, uint32_t p) { if (n >= 0) NVIC->IP[n] = (p << 4) & 0xFF; else SCB->SHP[(n & 15) - 4] = (p << 4) & 0xFF; }
static inline void __enable_irq(void) { __asm volatile("cpsie i" ::: "memory"); }
static inline void __disable_irq(void) { __asm volatile("cpsid i" ::: "memory"); }
static inline void __WFI(void) { __asm volatile("wfi"); }
static inline void __NOP(void) { __asm volatile("nop"); }
static inline void __DSB(void) { __asm volatile("dsb" ::: "memory"); }
static inline uint32_t __get_PRIMASK(void) { uint32_t r; __asm volatile("mrs %0, primask" : "=r"(r)); return r; }
static inline void __set_PRIMASK(uint32_t v) { __asm volatile("msr primask, %0" ::"r"(v) : "memory"); }
static inline void NVIC_SystemReset(void) { __DSB(); SCB->AIRCR = (0x5FAu << 16) | (SCB->AIRCR & 0x700) | 4; __DSB(); for (;;) {} }
