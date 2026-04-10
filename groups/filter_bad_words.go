package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"strings"
)

// Yasaklı kelimelerin listesi
var badWords = []string{
	"fuck", "shit", "bitch", "asshole", "bastard", "damn", "cunt", "dick", "piss", "crap", "motherfucker", "bollocks",
	"porn", "nude", "sex", "boobs", "vagina", "penis", "orgasm", "cum", "anal", "nipple", "suck", "blowjob", "dildo",
	"nigger", "chink", "fag", "retard", "spic", "kike", "tranny",
	"weed", "cocaine", "heroin", "meth", "stoned", "drunk", "high", "dope",
	"kill", "murder", "rape", "abuse", "stab", "slaughter",
}

// Kelime bilgisi yapısı
type WordInfo struct {
	Word    string `json:"word"`
	Meaning string `json:"meaning"`
	Example string `json:"example"`
}

func main() {
	// Dosya yolları
	inputFile := "all_words.json"
	outputFile := "filtered_words.json"

	// JSON dosyasını oku
	data, err := ioutil.ReadFile(inputFile)
	if err != nil {
		fmt.Printf("Dosya okuma hatası: %v\n", err)
		os.Exit(1)
	}

	// JSON verisini ayrıştır
	var wordsData map[string][]WordInfo
	err = json.Unmarshal(data, &wordsData)
	if err != nil {
		fmt.Printf("JSON ayrıştırma hatası: %v\n", err)
		os.Exit(1)
	}

	// Toplam kelime sayısını hesapla
	totalWords := 0
	for _, wordList := range wordsData {
		totalWords += len(wordList)
	}
	fmt.Printf("Toplam kelime sayısı: %d\n", totalWords)

	// Filtreleme işlemi
	filteredWordsData := make(map[string][]WordInfo)
	removedCount := 0

	for category, wordList := range wordsData {
		filteredList := make([]WordInfo, 0)

		for _, wordInfo := range wordList {
			// "word", "meaning" veya "example" alanlarında yasaklı kelime var mı kontrol et
			if !containsBadWord(wordInfo.Word) &&
				!containsBadWord(wordInfo.Meaning) &&
				!containsBadWord(wordInfo.Example) {
				filteredList = append(filteredList, wordInfo)
			} else {
				removedCount++
			}
		}

		if len(filteredList) > 0 {
			filteredWordsData[category] = filteredList
		}
	}

	// Filtreleme sonrası toplam kelime sayısı
	filteredTotal := 0
	for _, wordList := range filteredWordsData {
		filteredTotal += len(wordList)
	}

	fmt.Printf("Filtreleme sonrası kelime sayısı: %d\n", filteredTotal)
	fmt.Printf("Kaldırılan kelime sayısı: %d\n", removedCount)

	// Filtrelenmiş verileri JSON formatında kaydet
	filteredData, err := json.MarshalIndent(filteredWordsData, "", "  ")
	if err != nil {
		fmt.Printf("JSON oluşturma hatası: %v\n", err)
		os.Exit(1)
	}

	err = ioutil.WriteFile(outputFile, filteredData, 0644)
	if err != nil {
		fmt.Printf("Dosya yazma hatası: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Filtrelenmiş veriler %s dosyasına kaydedildi.\n", outputFile)
}

// Verilen metinde yasaklı bir kelime olup olmadığını kontrol eder
func containsBadWord(text string) bool {
	textLower := strings.ToLower(text)

	for _, badWord := range badWords {
		if strings.Contains(textLower, badWord) {
			return true
		}
	}

	return false
}
